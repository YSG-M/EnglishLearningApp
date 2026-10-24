/**
 * Minimal-pair listening question: one of two similar words is played, she picks which.
 * Shared by the practice part's phonics quiz and the review screen.
 */
import { useEffect, useMemo, useState } from 'react';
import type { PhonicsPairItem, Sentence } from '@shared/content/bundle';
import { stableShuffle } from '@shared/domain/exercise';
import { player } from '../../audio/player';
import { Button } from '../../components/ui';
import { zh } from '../../i18n/zh';

export function pickPairTarget(
  pair: PhonicsPairItem,
  seed: string,
): { target: Sentence; options: Sentence[] } {
  const [first] = stableShuffle([pair.a, pair.b], `${seed}:target`);
  return { target: first!, options: stableShuffle([pair.a, pair.b], `${seed}:options`) };
}

export function PairQuestion({
  pair,
  seed,
  onAnswer,
}: {
  pair: PhonicsPairItem;
  seed: string;
  onAnswer(correct: boolean): void;
}) {
  const { target, options } = useMemo(() => pickPairTarget(pair, seed), [pair, seed]);
  const [chosen, setChosen] = useState<Sentence | null>(null);

  useEffect(() => {
    const t = setTimeout(() => void player.play({ clip: target.audio, text: target.en }), 250);
    return () => clearTimeout(t);
  }, [target]);

  const choose = (o: Sentence) => {
    if (chosen) return;
    setChosen(o);
    const correct = o.audio === target.audio;
    onAnswer(correct);
    if (!correct) {
      // Hear both, in order, to notice the difference.
      void player.playSequence([
        { clip: o.audio, text: o.en },
        { clip: target.audio, text: target.en },
      ]);
    }
  };

  return (
    <div className="pair-question">
      <Button size="lg" onClick={() => void player.play({ clip: target.audio, text: target.en })}>
        🔊 {zh.common.play}
      </Button>
      <div className="choice-grid two">
        {options.map((o) => {
          const state = !chosen ? '' : o.audio === target.audio ? 'correct' : o === chosen ? 'wrong' : '';
          return (
            <button key={o.audio} type="button" className={`choice ${state}`} onClick={() => choose(o)}>
              <span className="choice-en">{o.en}</span>
              {chosen ? <span className="choice-zh">{o.zh}</span> : null}
            </button>
          );
        })}
      </div>
      {chosen ? (
        <p className={chosen.audio === target.audio ? 'success-text' : 'muted'}>
          {chosen.audio === target.audio ? `✅ ${zh.part.pairCorrect}` : zh.part.pairWrong(target.en)}
        </p>
      ) : null}
    </div>
  );
}
