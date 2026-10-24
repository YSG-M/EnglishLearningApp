/**
 * Compares what she said (recogniser transcript) with what she was meant to say.
 *
 * Word-level only: the recogniser tells us which words came out, not how each sound was made.
 * Phoneme-level scoring is a planned upgrade (docs/modules/voice.md).
 */
import { normalizeWords } from './normalize';

export type WordStatus = 'ok' | 'close' | 'missed';

export interface WordResult {
  /** Index into the target's normalised word list. */
  index: number;
  word: string;
  status: WordStatus;
  heard?: string;
}

export interface MatchResult {
  /** 0–1. Close words count half. */
  score: number;
  passed: boolean;
  words: WordResult[];
  /** Words she said that are not in the target. */
  extra: string[];
  heardText: string;
}

export const PASS_SCORE = 0.8;

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[a.length]![b.length]!;
}

/**
 * Consonant skeleton: what is left of a word's sound once vowels are ignored and letters that
 * spell the same sound are merged. The recogniser has to *spell* Singapore words it has never
 * seen ("aircon" comes out as "eirken"), and those spellings keep the consonants.
 */
function skeleton(word: string): string {
  return word
    .replace(/ph/g, 'f')
    .replace(/ck|q|c(?=[aoukrl]|$)/g, 'k')
    .replace(/c/g, 's')
    .replace(/z/g, 's')
    .replace(/[aeiouyhw']/g, '')
    .replace(/(.)\1+/g, '$1');
}

/** A near miss the recogniser often produces for accented speech or unfamiliar local words. */
function isClose(target: string, heard: string): boolean {
  if (target.length < 4 || heard.length < 3) return false;
  if (editDistance(target, heard) <= 1) return true;
  const k = skeleton(target);
  return k.length >= 3 && k === skeleton(heard);
}

/**
 * Aligns heard words against target words (Levenshtein over words, with "close" as a cheap
 * partial match) and reports each target word's status.
 */
export function matchSpeech(target: string, heardText: string): MatchResult {
  const t = normalizeWords(target);
  const h = normalizeWords(heardText);
  const n = t.length;
  const m = h.length;
  const sub = (i: number, j: number) => (t[i] === h[j] ? 0 : isClose(t[i]!, h[j]!) ? 0.5 : 1.2);
  const cost: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) cost[i]![0] = i;
  for (let j = 1; j <= m; j++) cost[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cost[i]![j] = Math.min(
        cost[i - 1]![j]! + 1,
        cost[i]![j - 1]! + 1,
        cost[i - 1]![j - 1]! + sub(i - 1, j - 1),
      );
    }
  }
  const words: WordResult[] = [];
  const extra: string[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      cost[i]![j] === cost[i - 1]![j - 1]! + sub(i - 1, j - 1) &&
      sub(i - 1, j - 1) < 1.2
    ) {
      const status: WordStatus = t[i - 1] === h[j - 1] ? 'ok' : 'close';
      words.push({ index: i - 1, word: t[i - 1]!, status, heard: h[j - 1]! });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || cost[i]![j] === cost[i - 1]![j]! + 1)) {
      words.push({ index: i - 1, word: t[i - 1]!, status: 'missed' });
      i--;
    } else if (j > 0 && (i === 0 || cost[i]![j] === cost[i]![j - 1]! + 1)) {
      extra.push(h[j - 1]!);
      j--;
    } else {
      // Substitution of an unrelated word: the target word was effectively missed.
      words.push({ index: i - 1, word: t[i - 1]!, status: 'missed', heard: h[j - 1]! });
      extra.push(h[j - 1]!);
      i--;
      j--;
    }
  }
  words.reverse();
  extra.reverse();
  const points = words.reduce((s, w) => s + (w.status === 'ok' ? 1 : w.status === 'close' ? 0.5 : 0), 0);
  // Extra words cost a little, so a long ramble cannot pass by accident.
  const score = n === 0 ? 0 : Math.max(0, (points - extra.length * 0.25) / n);
  return { score, passed: score >= PASS_SCORE, words, extra, heardText };
}

/** Matches against several acceptable answers and returns the best one. */
export function bestMatch(targets: string[], heardText: string): { index: number; result: MatchResult } {
  let best = { index: -1, result: matchSpeech(targets[0] ?? '', heardText) };
  targets.forEach((target, index) => {
    const result = matchSpeech(target, heardText);
    if (best.index === -1 || result.score > best.result.score) best = { index, result };
  });
  return best;
}
