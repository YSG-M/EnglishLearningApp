/**
 * One shared audio player: starting a clip stops whatever else is playing, so sounds never overlap.
 *
 * Course clips are pre-generated WAVs served over media://. If a clip is missing (e.g. audio not
 * generated yet in a dev build), it falls back to the Windows voice via speechSynthesis rather
 * than failing silently or blocking the lesson.
 */
import { contentAudioUrl } from '@shared/ipc';
import { setAudioSession, stopRecordingForPlayback } from './session';

export interface PlaybackError {
  kind: 'gesture' | 'missing';
  request: PlayRequest;
}
export interface PlayerOptions {
  resolveClip: (key: string) => string;
  allowSpeechSynthesis: boolean;
  onError?: (error: PlaybackError) => void;
}
let options: PlayerOptions = { resolveClip: contentAudioUrl, allowSpeechSynthesis: true };
export function configurePlayer(next: PlayerOptions): void {
  player.stop();
  options = next;
}

export interface PlayRequest {
  /** Course clip key, or a full URL (media://rec/..., blob:...). */
  clip?: string;
  url?: string;
  /** English text, used for the speechSynthesis fallback. */
  text?: string;
  rate?: number;
  /** Identifies the playing item for UI state (defaults to clip/url). */
  id?: string;
}

type Listener = (playingId: string | null) => void;

class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private playingId: string | null = null;
  private listeners = new Set<Listener>();
  private cancelCurrent: (() => void) | null = null;
  /** Bumped by every playback start; stale callbacks compare against it. */
  private gen = 0;
  /** Bumped by every public call; a running sequence stops when it changes. */
  private seq = 0;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get current(): string | null {
    return this.playingId;
  }

  private setPlaying(id: string | null) {
    this.playingId = id;
    for (const l of this.listeners) l(id);
  }

  stop(): void {
    this.seq++;
    this.halt();
  }

  private halt(): void {
    this.gen++;
    this.cancelCurrent?.();
    this.cancelCurrent = null;
    this.setPlaying(null);
  }

  /** Resolves when playback ends or is interrupted. Never rejects. */
  play(req: PlayRequest): Promise<void> {
    this.seq++;
    return this.start(req);
  }

  private start(req: PlayRequest): Promise<void> {
    this.halt();
    stopRecordingForPlayback();
    setAudioSession('playback');
    const my = ++this.gen;
    const id = req.id ?? req.clip ?? req.url ?? req.text ?? 'audio';
    let src: string | undefined;
    try {
      src = req.url ?? (req.clip ? options.resolveClip(req.clip) : undefined);
    } catch {
      options.onError?.({ kind: 'missing', request: req });
      this.seq++;
      return Promise.resolve();
    }
    this.setPlaying(id);

    return new Promise<void>((resolve) => {
      const end = () => {
        if (my === this.gen) {
          this.cancelCurrent = null;
          this.setPlaying(null);
        }
        resolve();
      };
      const fallback = (error?: unknown) => {
        if (my !== this.gen) return resolve();
        const gesture = error instanceof DOMException && error.name === 'NotAllowedError';
        if (!gesture && options.allowSpeechSynthesis && req.text && typeof speechSynthesis !== 'undefined')
          this.speak(req.text, req.rate ?? 1, end);
        else {
          this.seq++;
          options.onError?.({ kind: gesture ? 'gesture' : 'missing', request: req });
          end();
        }
      };
      if (!src) return fallback();

      this.audio ??= new Audio();
      const a = this.audio;
      a.onended = end;
      a.onerror = () => fallback();
      a.preservesPitch = true;
      a.src = src;
      a.playbackRate = req.rate ?? 1;
      this.cancelCurrent = () => {
        a.onended = null;
        a.onerror = null;
        a.pause();
        resolve();
      };
      a.play().catch(fallback);
    });
  }

  async playSequence(reqs: PlayRequest[], gapMs = 350): Promise<void> {
    const my = ++this.seq;
    for (let i = 0; i < reqs.length; i++) {
      await this.start(reqs[i]!);
      // Any play()/stop() from elsewhere abandons the rest of the sequence.
      if (this.seq !== my) return;
      if (i < reqs.length - 1) await new Promise((r) => setTimeout(r, gapMs));
      if (this.seq !== my) return;
    }
  }

  private speak(text: string, rate: number, onEnd: () => void) {
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang.startsWith('en'));
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-GB';
    u.rate = rate;
    u.onend = onEnd;
    u.onerror = onEnd;
    this.cancelCurrent = () => {
      u.onend = null;
      speechSynthesis.cancel();
      onEnd();
    };
    speechSynthesis.speak(u);
  }
}

export const player = new AudioPlayer();
