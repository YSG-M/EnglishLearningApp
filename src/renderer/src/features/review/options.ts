/** Builds multiple-choice options for listen-and-choose cards. */
import type { ContentBundle } from '@shared/content/bundle';
import { pickDistractors, stableShuffle } from '@shared/domain/exercise';
import type { ReviewItem } from '../../state/content';

export interface ChoiceOption {
  text: string;
  correct: boolean;
}

const OPTION_COUNT = 4;

function uniqueByText(list: string[], exclude: string): string[] {
  return [...new Set(list)].filter((t) => t !== exclude);
}

export function buildMeaningOptions(bundle: ContentBundle, item: ReviewItem, seed: string): ChoiceOption[] {
  let answer: string;
  let pool: string[];
  let wider: string[];
  if (item.kind === 'chunk') {
    answer = item.chunk.zh;
    pool = uniqueByText(
      item.unit.chunks.map((c) => c.zh),
      answer,
    );
    wider = uniqueByText(
      Object.values(bundle.units).flatMap((u) => u.chunks.map((c) => c.zh)),
      answer,
    );
  } else if (item.kind === 'word') {
    answer = item.word.zh;
    pool = uniqueByText(
      item.units.flatMap((u) => u.words.map((k) => bundle.lexicon[k]?.zh ?? '')).filter(Boolean),
      answer,
    );
    wider = uniqueByText(
      Object.values(bundle.lexicon).map((w) => w.zh),
      answer,
    );
  } else {
    return [];
  }
  const need = OPTION_COUNT - 1;
  const picked = pickDistractors(pool, () => false, need, seed);
  if (picked.length < need) {
    picked.push(...pickDistractors(wider, (t) => picked.includes(t), need - picked.length, `${seed}:wide`));
  }
  return stableShuffle(
    [{ text: answer, correct: true }, ...picked.map((text) => ({ text, correct: false }))],
    `${seed}:order`,
  );
}
