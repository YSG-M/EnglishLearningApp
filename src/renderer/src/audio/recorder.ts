/**
 * Microphone capture with automatic stop.
 *
 * Starts listening, waits for speech (level above an adaptive noise floor), then stops after
 * `silenceMs` of quiet. Output is resampled to 16 kHz mono for the recogniser.
 */
import workletUrl from './capture.worklet.ts?worker&url';
import { concatFloat32, resample, rms, TARGET_RATE } from './resample';
import { player } from './player';
import { registerRecording, setAudioSession, stopRecordingForPlayback } from './session';

export type StopReason = 'silence' | 'manual' | 'max' | 'no-speech';

export interface RecorderOptions {
  /** Stop after this much silence once speech has started. Ignored when autoStop is false. */
  silenceMs: number;
  autoStop: boolean;
  maxMs: number;
  /** Give up if nothing is said within this time. Ignored when autoStop is false. */
  noSpeechMs: number;
  /** 0–1 input level, ~12 times a second. */
  onLevel?: (level: number) => void;
}

export interface Recording {
  samples: Float32Array;
  sampleRate: typeof TARGET_RATE;
  durationMs: number;
  hadSpeech: boolean;
  stoppedBy: StopReason;
}

export interface RecordingSession {
  stop(): void;
  done: Promise<Recording>;
}

export class MicError extends Error {
  constructor(
    readonly kind: 'denied' | 'missing' | 'other',
    message: string,
  ) {
    super(message);
  }
}

const MIN_SPEECH_RMS = 0.015;
const CALIBRATION_MS = 250;

export async function startRecording(opts: RecorderOptions, signal?: AbortSignal): Promise<RecordingSession> {
  player.stop();
  stopRecordingForPlayback();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  setAudioSession('play-and-record');
  const ctx = new AudioContext();
  let cancelled = false;
  const cancelPermission = () => {
    cancelled = true;
    void ctx.close().catch(() => {});
    setAudioSession('playback');
  };
  signal?.addEventListener('abort', cancelPermission, { once: true });
  registerRecording(cancelPermission);
  // Resume in the click's call stack, before the permission request can consume activation.
  const resumed = ctx.resume();
  void resumed.catch(() => {});
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    signal?.removeEventListener('abort', cancelPermission);
    registerRecording(null);
    void ctx.close().catch(() => {});
    setAudioSession('playback');
    const name = (err as DOMException).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new MicError('denied', String(err));
    if (name === 'NotFoundError' || name === 'OverconstrainedError')
      throw new MicError('missing', String(err));
    throw new MicError('other', String(err));
  }
  signal?.removeEventListener('abort', cancelPermission);

  let source: MediaStreamAudioSourceNode;
  let node: AudioWorkletNode;
  let mute: GainNode;
  const stopTracks = () => stream.getTracks().forEach((t) => t.stop());
  const cancelSetup = () => {
    cancelled = true;
    stopTracks();
    void ctx.close().catch(() => {});
    setAudioSession('playback');
  };
  signal?.addEventListener('abort', cancelSetup, { once: true });
  registerRecording(cancelSetup);
  try {
    if (signal?.aborted || cancelled) throw new DOMException('Cancelled', 'AbortError');
    await resumed;
    await ctx.audioWorklet.addModule(workletUrl);
    if (signal?.aborted || cancelled) throw new DOMException('Cancelled', 'AbortError');
    source = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'capture-processor');
    // The worklet must be pulled by the graph to run; a muted gain keeps it silent.
    mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(ctx.destination);
  } catch (err) {
    stopTracks();
    signal?.removeEventListener('abort', cancelSetup);
    // Initialization can fail after microphone access succeeds.
    registerRecording(null);
    void ctx.close().catch(() => {});
    setAudioSession('playback');
    throw err;
  }
  signal?.removeEventListener('abort', cancelSetup);

  const rate = ctx.sampleRate;
  const chunks: Float32Array[] = [];
  let elapsedMs = 0;
  let noiseSum = 0;
  let noiseCount = 0;
  let threshold = MIN_SPEECH_RMS;
  let speechStarted = false;
  let lastSpeechMs = 0;
  let finished = false;

  let resolveDone!: (r: Recording) => void;
  const done = new Promise<Recording>((r) => (resolveDone = r));

  const finish = (reason: StopReason) => {
    if (finished) return;
    finished = true;
    node.port.onmessage = null;
    source.disconnect();
    node.disconnect();
    mute.disconnect();
    stopTracks();
    signal?.removeEventListener('abort', onAbort);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onAbort);
    clearTimeout(deadline);
    registerRecording(null);
    setAudioSession('playback');
    void ctx.close().catch(() => {});
    const all = concatFloat32(chunks);
    // Trim the trailing silence that triggered the auto-stop, keeping a little tail.
    const keepMs = reason === 'silence' ? Math.min(elapsedMs, lastSpeechMs + 300) : elapsedMs;
    const trimmed = all.subarray(0, Math.min(all.length, Math.round((keepMs / 1000) * rate)));
    const samples = resample(trimmed, rate);
    resolveDone({
      samples,
      sampleRate: TARGET_RATE,
      durationMs: Math.round((samples.length / TARGET_RATE) * 1000),
      hadSpeech: speechStarted,
      stoppedBy: reason,
    });
  };
  const onAbort = () => finish('manual');
  const onVisibility = () => {
    if (document.hidden) onAbort();
  };
  const deadline = setTimeout(() => finish('max'), opts.maxMs);
  signal?.addEventListener('abort', onAbort, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onAbort);
  registerRecording(onAbort);

  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const chunk = e.data;
    chunks.push(chunk);
    const chunkMs = (chunk.length / rate) * 1000;
    elapsedMs += chunkMs;
    const level = rms(chunk);
    opts.onLevel?.(Math.min(1, level * 8));

    if (elapsedMs <= CALIBRATION_MS) {
      noiseSum += level;
      noiseCount++;
      threshold = Math.max(MIN_SPEECH_RMS, (noiseSum / noiseCount) * 3);
    } else if (level > threshold) {
      speechStarted = true;
      lastSpeechMs = elapsedMs;
    }

    if (elapsedMs >= opts.maxMs) finish('max');
    else if (opts.autoStop && speechStarted && elapsedMs - lastSpeechMs >= opts.silenceMs) finish('silence');
    else if (opts.autoStop && !speechStarted && elapsedMs >= opts.noSpeechMs) finish('no-speech');
  };

  return { stop: () => finish('manual'), done };
}
