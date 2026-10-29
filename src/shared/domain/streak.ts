/**
 * Study-day tracking designed not to punish.
 *
 * The headline number is `totalDays`, which never goes down. The streak is secondary and is
 * protected by rest cards (休息卡): a missed day spends one instead of breaking the streak.
 * Research basis: missing a single day barely affects habit formation (Lally et al., 2009).
 */
import { addDays, daysBetween, type DayString } from './dates';

export const MAX_REST_CARDS = 2;
export const REST_CARD_EVERY = 7;
/** Minimum active time for a day to count, unless she finished the day's work sooner. */
export const MIN_ACTIVE_MS = 5 * 60_000;

export interface StreakState {
  totalDays: number;
  current: number;
  best: number;
  lastStudyDay: DayString | null;
  restCards: number;
}

export const initialStreak: StreakState = {
  totalDays: 0,
  current: 0,
  best: 0,
  lastStudyDay: null,
  restCards: 1,
};

export interface ReconcileResult {
  state: StreakState;
  /** Rest cards spent to cover missed days since the last visit. */
  restCardsUsed: number;
  /** True when the streak had to restart; the UI words this gently. */
  streakReset: boolean;
}

/** Called when the app opens: settles any days missed since the last study day. */
export function reconcileStreak(state: StreakState, today: DayString): ReconcileResult {
  if (!state.lastStudyDay || state.current === 0) return { state, restCardsUsed: 0, streakReset: false };
  const missed = daysBetween(state.lastStudyDay, today) - 1;
  if (missed <= 0) return { state, restCardsUsed: 0, streakReset: false };
  if (missed <= state.restCards) {
    // Treat the covered days as bridged: move lastStudyDay forward so they are not charged twice.
    const bridgedTo = addDays(state.lastStudyDay, missed);
    return {
      state: { ...state, restCards: state.restCards - missed, lastStudyDay: bridgedTo },
      restCardsUsed: missed,
      streakReset: false,
    };
  }
  return { state: { ...state, current: 0 }, restCardsUsed: 0, streakReset: true };
}

/** Records that `today` counts as a study day. Idempotent within a day. */
export function markStudyDay(state: StreakState, today: DayString): StreakState {
  if (state.lastStudyDay === today) return state;
  const continues = state.lastStudyDay !== null && daysBetween(state.lastStudyDay, today) === 1;
  const current = continues ? state.current + 1 : 1;
  const earned = current % REST_CARD_EVERY === 0 ? 1 : 0;
  return {
    totalDays: state.totalDays + 1,
    current,
    best: Math.max(state.best, current),
    lastStudyDay: today,
    restCards: Math.min(MAX_REST_CARDS, state.restCards + earned),
  };
}
