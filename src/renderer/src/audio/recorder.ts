/**
 * Microphone capture with automatic stop.
 *
 * Starts listening, waits for speech (level above an adaptive noise floor), then stops after
 * `silenceMs` of quiet. Output is resampled to 16 kHz mono for the recogniser.
 */
import workletUrl from './capture.worklet.ts?worker&url';
import { concatFloat32, resample, rms, TARGET_RATE } from './resample';

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

export async function startRecording(opts: RecorderOptions): Promise<RecordingSession> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new MicError('denied', String(err));
    if (name === 'NotFoundError' || name === 'OverconstrainedError')
      throw new MicError('missing', String(err));
    throw new MicError('other', String(err));
  }

  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(workletUrl);
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'capture-processor');
  // The worklet must be pulled by the graph to run; a muted gain keeps it silent.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(node).connect(mute).connect(ctx.destination);

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
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
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
