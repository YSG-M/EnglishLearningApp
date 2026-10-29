/** Calendar-day helpers. A "day" is the learner's local calendar day, written YYYY-MM-DD. */

export type DayString = string;

export function toDay(d: Date): DayString {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDay(day: DayString): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Whole calendar days from `a` to `b` (positive when b is later). DST-safe. */
export function daysBetween(a: DayString, b: DayString): number {
  const ms = parseDay(b).getTime() - parseDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(day: DayString, n: number): DayString {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** End of the given local day; used so "due today" includes cards due later today. */
export function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
