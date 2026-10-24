/**
 * Turns a speech match into encouraging feedback: one piece of praise, at most one tip.
 * Never a bare score, never a list of everything that was wrong.
 */
import type { WordEntry } from '../content/bundle';
import type { Token } from '../content/tokenize';
import { normalizeWords } from './normalize';
import type { MatchResult } from './speechMatch';

export type FeedbackTone = 'great' | 'good' | 'retry' | 'silent';

export interface Feedback {
  tone: FeedbackTone;
  praise: string;
  tip?: string;
  /** Lexicon keys of words to highlight in the sentence. */
  focusKeys: string[];
}

const PRAISE: Record<FeedbackTone, string[]> = {
  great: ['太棒了！完全正确 🎉', '说得很清楚！👏', '非常好，就是这样！', '漂亮！听起来很自然 🌟'],
  good: ['很好，已经说对了！', '不错！意思完全能听懂 👍', '说对了！再熟练一点就更自然了'],
  retry: ['差一点点，再试一次！', '没关系，先听一遍原音，再跟着说', '慢慢来，一个词一个词说也可以'],
  silent: ['没听到声音，再说一次？可以离麦克风近一点 🎤'],
};

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length]!;
}

export function buildFeedback(
  match: MatchResult,
  tokens: Token[],
  lexicon: Record<string, WordEntry>,
  seed = 0,
): Feedback {
  if (!match.heardText.trim()) return { tone: 'silent', praise: pick(PRAISE.silent, seed), focusKeys: [] };

  const tone: FeedbackTone = match.score >= 0.95 ? 'great' : match.passed ? 'good' : 'retry';
  const problem = match.words.find((w) => w.status !== 'ok');
  if (!problem) return { tone, praise: pick(PRAISE[tone], seed), focusKeys: [] };

  const token = tokens.find((t) => normalizeWords(t.surface).includes(problem.word));
  const entry = token?.key ? lexicon[token.key] : undefined;
  const shown = entry?.text ?? problem.word;
  let tip: string;
  if (entry?.hint.note) {
    tip = `"${shown}"：${entry.hint.note}`;
  } else if (problem.status === 'close') {
    tip = `"${shown}" 很接近了，再听一遍原音，注意它的读法`;
  } else {
    tip = `别忘了说 "${shown}"`;
  }
  return { tone, praise: pick(PRAISE[tone], seed), tip, focusKeys: entry ? [entry.key] : [] };
}
