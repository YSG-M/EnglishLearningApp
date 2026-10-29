/**
 * Matches a tokenised sentence against a pattern frame such as "Can I have ___, please?".
 *
 * Comparison is by word only (punctuation and case are ignored). Words before the frame are
 * allowed ("Sorry, can you say that again?" fits "Can you ___?"), but the frame's last words
 * must end the sentence, so the slot is always the part between them.
 */
import type { Token } from './tokenize';
import { tokenize } from './tokenize';

const SLOT = '___';

const word = (t: Token): string => t.key ?? t.surface.toLowerCase();

export function frameParts(frame: string): { before: string[]; after: string[] } {
  const words = tokenize(frame).map(word);
  const i = words.indexOf(SLOT);
  if (i < 0) throw new Error(`Pattern frame has no ${SLOT}: ${frame}`);
  return { before: words.slice(0, i), after: words.slice(i + 1) };
}

/** Token range [start, end) that fills the slot, or null when the sentence does not fit. */
export function matchFrame(frame: string, tokens: Token[]): [number, number] | null {
  const { before, after } = frameParts(frame);
  const words = tokens.map(word);
  const end = words.length - after.length;
  if (after.some((w, k) => words[end + k] !== w)) return null;
  for (let start = 0; start + before.length < end; start++) {
    if (before.every((w, k) => words[start + k] === w)) return [start + before.length, end];
  }
  return null;
}

/** First frame (by index) the sentence fits. */
export function matchFrames(
  frames: readonly { frame: string }[],
  tokens: Token[],
): { frame: number; slot: [number, number] } | null {
  for (let i = 0; i < frames.length; i++) {
    const slot = matchFrame(frames[i]!.frame, tokens);
    if (slot) return { frame: i, slot };
  }
  return null;
}
