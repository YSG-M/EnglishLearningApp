/**
 * Implements the AppApi contract (src/shared/ipc.ts) by delegating to services.
 * Contains no Electron imports, so the whole API can be exercised in tests.
 */
import type { AppApi, AppInfo, RecognizeInput } from '../shared/ipc';
import type { ContentService } from './services/contentService';
import type { DiagnosticsService } from './services/diagnosticsService';
import type { LearningService } from './services/learningService';
import type { RecordingService } from './services/recordingService';
import { toView } from './services/recordingService';
import type { AsrProvider } from './speech/asrProvider';
import { AppError } from './errors';
import type { Logger } from './logger';
import { errorMeta } from './logger';

export interface ApiDeps {
  info: () => AppInfo;
  content: ContentService;
  learning: LearningService;
  recordings: RecordingService;
  asr: AsrProvider;
  diagnostics: DiagnosticsService;
  logger: Logger;
  /** Renderer log lines go through here. */
  rendererLog: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => void;
}

const asyncify =
  <A extends unknown[], R>(fn: (...a: A) => R) =>
  async (...a: A): Promise<Awaited<R>> =>
    await fn(...a);

export function createAppApi(d: ApiDeps): AppApi {
  const recognize = async (input: RecognizeInput) => {
    const status = d.asr.getStatus();
    if (status.state === 'unavailable')
      throw new AppError('SPEECH_UNAVAILABLE', status.message ?? '语音识别不可用。');
    const durationMs = Math.round((input.samples.length / input.sampleRate) * 1000);
    // Save first: even if recognition fails, her attempt is kept for comparison.
    let recordingId: string | null = null;
    if (input.keep) {
      try {
        recordingId = d.recordings.save(input.itemId, 'speech', input.samples, input.sampleRate).id;
      } catch (err) {
        d.logger.error('saving recording failed', errorMeta(err));
      }
    }
    let text: string;
    try {
      text = await d.asr.recognize(input.samples, input.sampleRate);
    } catch (err) {
      if (err instanceof AppError) throw err;
      d.logger.error('speech recognition failed', errorMeta(err));
      throw new AppError('SPEECH_FAILED', '没能识别这段录音，请再试一次。', { cause: err });
    }
    if (recordingId) d.recordings.setTranscript(recordingId, text);
    return { text, recordingId, durationMs };
  };

  return {
    app: { getInfo: asyncify(d.info) },
    content: { getBundle: asyncify(() => d.content.bundle()) },
    today: {
      get: asyncify(() => d.learning.getToday()),
      addActiveTime: asyncify((ms: number) => d.learning.addActiveTime(ms)),
    },
    parts: {
      complete: asyncify((input) => d.learning.completePart(input)),
      listCompleted: asyncify(() => d.learning.listCompletedParts()),
    },
    review: {
      getQueue: asyncify(() => d.learning.getReviewQueue()),
      submit: asyncify((input) => d.learning.submitReview(input)),
      getPracticeSet: asyncify((unitId: string) => d.learning.getPracticeSet(unitId)),
    },
    speech: {
      getStatus: asyncify(() => d.asr.getStatus()),
      recognize,
      annotateRecording: asyncify(({ recordingId, score, transcript }) => {
        if (!d.recordings.annotate(recordingId, score, transcript))
          throw new AppError('NOT_FOUND', '找不到这段录音。');
      }),
    },
    hints: {
      getProgress: asyncify(() => d.learning.getHintProgress()),
      recordCorrect: asyncify((keys: string[]) => d.learning.recordHintCorrect(keys)),
    },
    recordings: {
      list: asyncify((itemId: string) => d.recordings.list(itemId)),
      saveChallenge: asyncify(({ challengeId, samples, sampleRate }) => {
        if (!d.content.bundle().challenges[challengeId]) throw new AppError('NOT_FOUND', '找不到这个挑战。');
        return toView(d.recordings.save(challengeId, 'challenge', samples, sampleRate));
      }),
      listChallenges: asyncify(() => d.recordings.listChallenges()),
    },
    progress: { getStats: asyncify(() => d.learning.getStats()) },
    settings: {
      get: asyncify(() => d.learning.getSettings()),
      update: asyncify((patch) => d.learning.updateSettings(patch)),
    },
    diagnostics: {
      openLogsFolder: () => d.diagnostics.openLogsFolder(),
      exportBundle: asyncify(() => d.diagnostics.exportBundle()),
    },
    log: { write: asyncify(d.rendererLog) },
  };
}
