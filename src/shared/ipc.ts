/**
 * The contract between the renderer (UI) and the main process.
 *
 * Single source of truth: the main process implements `AppApi`, the preload script exposes it
 * as `window.api`, and the renderer calls it. Every method is async and maps to one IPC channel
 * named "<namespace>.<method>" (listed in API_CHANNELS, which the type system keeps in sync).
 *
 * Changing this file changes the contract for both sides: update docs/02-architecture.md too.
 */
import type { CardKind, ContentBundle } from './content/bundle';
import type { TodayPlan } from './domain/planner';
import type { ExerciseType } from './domain/exercise';
import type { Grade } from './domain/srs';
import type { StreakState } from './domain/streak';
import type { DayString } from './domain/dates';
import type { Settings } from './settings';

export interface AppInfo {
  appVersion: string;
  contentVersion: string;
  dataDir: string;
  logsDir: string;
  isDev: boolean;
}

export type SpeechState = 'ready' | 'loading' | 'unavailable' | 'error';

export interface SpeechStatus {
  state: SpeechState;
  /** Chinese, user-facing explanation when not ready. */
  message?: string;
}

export interface TodayView {
  today: DayString;
  plan: TodayPlan;
  streak: StreakState;
  /** Rest cards spent when the app opened today (for a gentle "we covered for you" note). */
  restCardsUsedToday: number;
  /** True the first time the app opens after the streak had to restart. */
  streakResetToday: boolean;
  activeMsToday: number;
  /** Whether today already counts as a study day. */
  dayCounted: boolean;
  partsCompletedToday: number;
  reviewsDoneToday: number;
}

export interface ReviewCardView {
  cardId: string;
  kind: CardKind;
  /** Chunk id, lexicon key, phonics pair id, or pattern example id. */
  itemId: string;
  reps: number;
  lapses: number;
  exercise: ExerciseType;
}

export interface ReviewSubmission {
  cardId: string;
  exercise: ExerciseType;
  grade: Grade;
  /** Time spent on this card, counted towards today's active time. */
  activeMs: number;
}

export interface CompletePartInput {
  partId: string;
  activeMs: number;
}

export interface CompletePartResult {
  /** New review cards created by this part. */
  cardsIntroduced: number;
  /** False when she was taking the part again. */
  firstTime: boolean;
  today: TodayView;
}

/** Audio sent from the renderer: mono PCM, already resampled to 16 kHz. */
export interface RecognizeInput {
  samples: Float32Array;
  sampleRate: 16000;
  /** What she was trying to say (chunk id, drill/dialogue sentence clip key...). Used to file the recording. */
  itemId: string;
  /** Keep the recording for progress comparison. */
  keep: boolean;
}

export interface RecognizeResult {
  text: string;
  recordingId: string | null;
  durationMs: number;
}

export interface RecordingView {
  id: string;
  itemId: string;
  createdAt: string;
  durationMs: number;
  /** media://rec/<file> URL for <audio>. */
  url: string;
  /** Speech match score 0–1 when known. */
  score: number | null;
  transcript: string | null;
}

export interface SaveChallengeInput {
  challengeId: string;
  samples: Float32Array;
  sampleRate: 16000;
}

export interface ProgressStats {
  streak: StreakState;
  partsCompleted: number;
  partsTotal: number;
  cardsLearned: number;
  /** Cards with an interval of 21+ days: "really remembered". */
  cardsMature: number;
  reviewsTotal: number;
  accuracy7d: number | null;
  /** Active minutes per day for the last 28 days, oldest first. */
  activity: { day: DayString; activeMs: number; counted: boolean }[];
  /** Hardest words: most lapses first. */
  troubleItems: { cardId: string; lapses: number }[];
}

export interface DiagnosticsExportResult {
  folder: string;
}

/**
 * Extra practice outside the schedule: cards from parts completed in the last RECENT_DAYS days,
 * one unit's cards, or a random draw from everything learned.
 */
export type PracticeScope =
  { scope: 'recent' } | { scope: 'unit'; unitId: string } | { scope: 'random'; count: number };

export const RECENT_DAYS = 7;

export interface AppApi {
  app: {
    getInfo(): Promise<AppInfo>;
  };
  content: {
    getBundle(): Promise<ContentBundle>;
  };
  today: {
    get(): Promise<TodayView>;
    /** Adds active learning time (the renderer reports it in small slices). */
    addActiveTime(ms: number): Promise<TodayView>;
  };
  parts: {
    complete(input: CompletePartInput): Promise<CompletePartResult>;
    listCompleted(): Promise<string[]>;
  };
  review: {
    getQueue(): Promise<ReviewCardView[]>;
    submit(input: ReviewSubmission): Promise<TodayView>;
    /** Extra practice outside the schedule (does not change intervals). */
    getPracticeSet(scope: PracticeScope): Promise<ReviewCardView[]>;
  };
  speech: {
    getStatus(): Promise<SpeechStatus>;
    recognize(input: RecognizeInput): Promise<RecognizeResult>;
    /** Stores the match score/transcript once the renderer has compared it. */
    annotateRecording(input: { recordingId: string; score: number; transcript: string }): Promise<void>;
  };
  hints: {
    /** Correct-answer count per lexicon key. */
    getProgress(): Promise<Record<string, number>>;
    recordCorrect(keys: string[]): Promise<Record<string, number>>;
  };
  recordings: {
    list(itemId: string): Promise<RecordingView[]>;
    saveChallenge(input: SaveChallengeInput): Promise<RecordingView>;
    listChallenges(): Promise<RecordingView[]>;
  };
  progress: {
    getStats(): Promise<ProgressStats>;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: Partial<Settings>): Promise<Settings>;
  };
  diagnostics: {
    openLogsFolder(): Promise<void>;
    exportBundle(): Promise<DiagnosticsExportResult>;
  };
  log: {
    write(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): Promise<void>;
  };
}

type Channels<T> = {
  [NS in keyof T & string]: { [M in keyof T[NS] & string]: `${NS}.${M}` }[keyof T[NS] & string];
}[keyof T & string];

export type ApiChannel = Channels<AppApi>;

export const API_CHANNELS = [
  'app.getInfo',
  'content.getBundle',
  'today.get',
  'today.addActiveTime',
  'parts.complete',
  'parts.listCompleted',
  'review.getQueue',
  'review.submit',
  'review.getPracticeSet',
  'speech.getStatus',
  'speech.recognize',
  'speech.annotateRecording',
  'hints.getProgress',
  'hints.recordCorrect',
  'recordings.list',
  'recordings.saveChallenge',
  'recordings.listChallenges',
  'progress.getStats',
  'settings.get',
  'settings.update',
  'diagnostics.openLogsFolder',
  'diagnostics.exportBundle',
  'log.write',
] as const satisfies readonly ApiChannel[];

// Compile-time check that API_CHANNELS lists every channel exactly: fails if one is missing.
type _MissingChannels = Exclude<ApiChannel, (typeof API_CHANNELS)[number]>;
const _allChannelsListed: _MissingChannels extends never ? true : _MissingChannels = true;
void _allChannelsListed;

/** URL scheme served by the main process for audio. */
export const MEDIA_SCHEME = 'media';
export function contentAudioUrl(clipKey: string): string {
  return `${MEDIA_SCHEME}://audio/${clipKey}.wav`;
}

/** Errors crossing IPC carry a stable code so the UI can show the right Chinese message. */
export type AppErrorCode =
  'SPEECH_UNAVAILABLE' | 'SPEECH_FAILED' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INTERNAL';
