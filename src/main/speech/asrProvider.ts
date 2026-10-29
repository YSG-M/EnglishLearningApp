import type { SpeechStatus } from '../../shared/ipc';

/** Speech-to-text. Implementations: WhisperAsrProvider (real), UnavailableAsrProvider, test fakes. */
export interface AsrProvider {
  getStatus(): SpeechStatus;
  /** Returns the transcript; empty string when nothing was said. */
  recognize(samples: Float32Array, sampleRate: number): Promise<string>;
  /** Optional: load the model ahead of first use so the first answer is fast. */
  warmup?(): void;
  dispose?(): void;
}

export class UnavailableAsrProvider implements AsrProvider {
  constructor(
    private readonly message = '没有找到语音识别模型。你仍然可以学习，复习时用"自己评分"就可以。',
  ) {}

  getStatus(): SpeechStatus {
    return { state: 'unavailable', message: this.message };
  }

  recognize(): Promise<string> {
    return Promise.reject(new Error('speech recognition unavailable'));
  }
}

/** For tests: returns queued transcripts in order. */
export class FakeAsrProvider implements AsrProvider {
  readonly calls: { length: number; sampleRate: number }[] = [];
  constructor(private readonly replies: string[] = []) {}

  getStatus(): SpeechStatus {
    return { state: 'ready' };
  }

  recognize(samples: Float32Array, sampleRate: number): Promise<string> {
    this.calls.push({ length: samples.length, sampleRate });
    return Promise.resolve(this.replies.shift() ?? '');
  }
}
