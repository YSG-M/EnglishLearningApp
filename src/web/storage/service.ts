import type { ContentBundle } from '../../shared/content/bundle';
import { CHANNEL_ARGS } from '../../main/ipc/schemas';
import type { ApiChannel } from '../../shared/ipc';
import type { Database } from './database';
import type { PersonalFiles } from './files';
import { createRepositories } from './repositories';
import { LearningService } from './learningService';
import { WebRecordings } from './recordings';
import { BackupService, inspectBackup } from './backup';
import { AppError } from './errors';
import { silentLogger, type Clock } from './support';
import { recordingItemIds } from './contentIds';

export class StorageService {
  readonly learning: LearningService;
  readonly recordings: WebRecordings;
  readonly backup: BackupService;
  speechAvailable = false;
  constructor(
    readonly db: Database,
    readonly files: PersonalFiles,
    readonly bundle: ContentBundle,
    clock: Clock = { now: () => new Date() },
  ) {
    db.exec('CREATE TABLE IF NOT EXISTS web_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.learning = new LearningService({
      db,
      repos: createRepositories(db),
      content: () => bundle,
      clock,
      logger: silentLogger,
      speechAvailable: () => this.speechAvailable,
    });
    this.recordings = new WebRecordings(db, files);
    this.backup = new BackupService(db, files, bundle);
  }
  async call(method: string, args: unknown[]): Promise<unknown> {
    if (method in CHANNEL_ARGS) {
      const schema = CHANNEL_ARGS[method as ApiChannel];
      const parsed = schema.safeParse(args);
      if (!parsed.success) throw new AppError('INVALID_INPUT', '输入格式无效。');
      args = parsed.data;
    }
    const l = this.learning;
    // Each case retains the desktop API's validation before typed service dispatch.
    switch (method) {
      case 'today.get':
        return l.getToday();
      case 'today.addActiveTime':
        return l.addActiveTime(args[0] as number);
      case 'parts.complete':
        return l.completePart(args[0] as Parameters<typeof l.completePart>[0]);
      case 'parts.listCompleted':
        return l.listCompletedParts();
      case 'review.getQueue':
        return l.getReviewQueue();
      case 'review.submit':
        return l.submitReview(args[0] as Parameters<typeof l.submitReview>[0]);
      case 'review.getPracticeSet':
        return l.getPracticeSet(args[0] as Parameters<typeof l.getPracticeSet>[0]);
      case 'hints.getProgress':
        return l.getHintProgress();
      case 'hints.recordCorrect':
        return l.recordHintCorrect(args[0] as string[]);
      case 'progress.getStats':
        return l.getStats();
      case 'settings.get':
        return l.getSettings();
      case 'settings.update':
        return l.updateSettings(args[0] as Parameters<typeof l.updateSettings>[0]);
      case 'speech.available':
        this.speechAvailable = args[0] === true;
        return;
      case 'speech.annotateRecording': {
        const a = args[0] as { recordingId: string; score: number; transcript: string };
        if (!this.recordings.repo.annotate(a.recordingId, a.score, a.transcript))
          throw new AppError('NOT_FOUND', '找不到这段录音。');
        return;
      }
      case 'recordings.saveChallenge': {
        const a = args[0] as { challengeId: string; samples: Float32Array; sampleRate: 16000 };
        if (!Object.hasOwn(this.bundle.challenges, a.challengeId))
          throw new AppError('NOT_FOUND', '找不到这个挑战。');
        const r = await this.recordings.save(a.challengeId, 'challenge', a.samples, a.sampleRate);
        return (await this.recordings.withBlobs([r]))[0];
      }
      case 'recordings.list':
        return this.recordings.withBlobs(this.recordings.repo.listForItem(args[0] as string));
      case 'recordings.listChallenges':
        return this.recordings.withBlobs(this.recordings.repo.listByKind('challenge'));
      case 'recordings.saveSpeech': {
        const parsed = CHANNEL_ARGS['speech.recognize'].safeParse(args);
        if (!parsed.success) throw new AppError('INVALID_INPUT', '录音格式无效。');
        const a = parsed.data[0];
        if (!recordingItemIds(this.bundle).has(a.itemId))
          throw new AppError('NOT_FOUND', '找不到对应的学习内容。');
        return (await this.recordings.save(a.itemId, 'speech', a.samples, a.sampleRate)).id;
      }
      case 'recordings.transcript': {
        if (typeof args[0] !== 'string' || typeof args[1] !== 'string' || args[1].length > 2000)
          throw new AppError('INVALID_INPUT', '识别结果格式无效。');
        this.recordings.repo.setTranscript(args[0], args[1]);
        return;
      }
      case 'backup.export':
        return this.backup.exportFile();
      case 'backup.inspect': {
        const b = await inspectBackup(args[0] as Blob, this.bundle);
        return { createdAt: b.createdAt, recordingCount: b.recordings.length };
      }
      case 'backup.import':
        return this.backup.importFile(args[0] as Blob);
      case 'dispose':
        this.db.close();
        this.files.close();
        return;
      default:
        throw new AppError('INVALID_INPUT', '未知存储操作。');
    }
  }
}
