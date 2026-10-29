import type { Database } from '../database';
import { CardRepository } from './cards';
import {
  DailyActivityRepository,
  EventRepository,
  HintProgressRepository,
  PartProgressRepository,
  StreakRepository,
} from './progress';
import { RecordingRepository } from './recordings';
import { ReviewLogRepository } from './reviewLogs';
import { SettingsRepository } from './settings';

export interface Repositories {
  cards: CardRepository;
  reviewLogs: ReviewLogRepository;
  parts: PartProgressRepository;
  activity: DailyActivityRepository;
  streak: StreakRepository;
  hints: HintProgressRepository;
  recordings: RecordingRepository;
  settings: SettingsRepository;
  events: EventRepository;
}

export function createRepositories(db: Database): Repositories {
  return {
    cards: new CardRepository(db),
    reviewLogs: new ReviewLogRepository(db),
    parts: new PartProgressRepository(db),
    activity: new DailyActivityRepository(db),
    streak: new StreakRepository(db),
    hints: new HintProgressRepository(db),
    recordings: new RecordingRepository(db),
    settings: new SettingsRepository(db),
    events: new EventRepository(db),
  };
}
