/**
 * The four review exercise types. Each reports an ExerciseOutcome exactly once via `onOutcome`;
 * the session maps it to a scheduling grade with `gradeOutcome`.
 */
import { useEffect, useMemo, useState } from 'react';
import type { SpokenSentence } from '@shared/content/bundle';
import type { ExerciseOutcome } from '@shared/domain/exercise';
import type { Grade } from '@shared/domain/srs';
import { tokenize } from '@shared/content/tokenize';
import { player } from '../../audio/player';
import { PlayRow } from '../../components/AudioButtons';
import { SpeakPanel } from '../../components/SpeakPanel';
import { TokenLine } from '../../components/TokenLine';
import { Button } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { useApp } from '../../state/AppContext';
import type { ReviewItem } from '../../state/content';
import { PairQuestion } from '../phonics/PairQuestion';
import { buildMeaningOptions } from './options';

export interface ExerciseProps {
  item: ReviewItem;
  seed: string;
  onOutcome(o: ExerciseOutcome): void;
}

/** The sentence or word a card asks her to produce, in the shape the speech tools need. */
export function answerOf(item: ReviewItem): { sentence: SpokenSentence; accept: string[] } | null {
  if (item.kind === 'chunk') return { sentence: item.chunk, accept: item.chunk.accept ?? [] };
  if (item.kind === 'word') {
    const w = item.word;
    return { sentence: { en: w.text, zh: w.zh, audio: w.audio, tokens: tokenize(w.text) }, accept: [] };
  }
  return null;
}

export function ListenChoose({ item, seed, onOutcome }: ExerciseProps) {
  const { bundle } = useApp();
  const options = useMemo(() => buildMeaningOptions(bundle, item, seed), [bundle, item, seed]);
  const answer = answerOf(item);
  const [chosen, setChosen] = useState<number | null>(null);

  const clip = answer?.sentence.audio;
  const text = answer?.sentence.en;
  useEffect(() => {
    if (!clip) return;
    const t = setTimeout(() => void player.play({ clip, ...(text ? { text } : {}) }), 250);
    return () => clearTimeout(t);
  }, [clip, text]);

  if (!answer) return null;
  return (
    <div className="exercise">
      <h2>👂 {zh.review.listenChoose}</h2>
      <PlayRow sentence={answer.sentence} size="lg" />
      <div className="choice-grid">
        {options.map((o, i) => {
          const state = chosen === null ? '' : o.correct ? 'correct' : chosen === i ? 'wrong' : '';
          return (
            <button
              key={o.text}
              type="button"
              className={`choice ${state}`}
              disabled={chosen !== null}
              onClick={() => {
                setChosen(i);
                onOutcome({ type: 'choice', correct: o.correct });
              }}
            >
              {o.text}
            </button>
          );
        })}
      </div>
      {chosen !== null ? (
        <p className="answer-reveal">
          <span className="en">{answer.sentence.en}</span>
        </p>
      ) : null}
    </div>
  );
}

export function SpeakFromZh({ item, onOutcome }: ExerciseProps) {
  const { bundle, hintProgress } = useApp();
  const answer = answerOf(item);
  const [level, setLevel] = useState(0);
  const [done, setDone] = useState<'passed' | 'gaveUp' | null>(null);
  if (!answer) return null;
  const { sentence, accept } = answer;
  const firstWord = sentence.tokens[0]?.surface ?? '';
  const itemId = item.kind === 'chunk' ? item.chunk.id : `word:${sentence.en.toLowerCase()}`;

  const finish = (o: ExerciseOutcome, d: 'passed' | 'gaveUp') => {
    if (done) return;
    setDone(d);
    onOutcome(o);
  };

  return (
    <div className="exercise">
      <h2>🗣 {zh.review.speakFromZh}</h2>
      <p className="prompt-zh">{sentence.zh}</p>
      {level >= 1 && level < 3 ? (
        <p className="hint-line">
          {zh.review.hintFirstWord}
          <strong>{firstWord} …</strong>
        </p>
      ) : null}
      {level === 2 ? (
        <div>
          <span className="muted small">{zh.review.hintSound}</span>
          {/* Second hint: the 谐音 line, even if hints are faded or switched off. */}
          <TokenLine
            tokens={sentence.tokens}
            lexicon={bundle.lexicon}
            hintProgress={{}}
            showHints
            size="md"
          />
        </div>
      ) : null}
      {level >= 3 || done === 'gaveUp' ? (
        <div className="answer-reveal">
          <span className="muted small">{zh.review.hintFull}</span>
          <TokenLine
            tokens={sentence.tokens}
            lexicon={bundle.lexicon}
            hintProgress={hintProgress}
            showHints
            size="md"
          />
          <PlayRow sentence={sentence} />
        </div>
      ) : null}
      {done !== 'gaveUp' ? (
        <SpeakPanel
          targets={[sentence.en, ...accept]}
          tokens={sentence.tokens}
          itemId={itemId}
          reference={{ clip: sentence.audio, text: sentence.en }}
          onResult={(r) => {
            if (r.passed) {
              finish(
                { type: 'speech', passed: true, attempts: r.attempts, usedHint: level > 0, gaveUp: false },
                'passed',
              );
              void player.play({ clip: sentence.audio, text: sentence.en });
            }
          }}
        />
      ) : null}
      {!done ? (
        <div className="row">
          {level < 3 ? (
            <Button onClick={() => setLevel(level + 1)}>
              {zh.review.hint} ({level + 1}/3)
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => {
              finish({ type: 'speech', passed: false, attempts: 1, usedHint: true, gaveUp: true }, 'gaveUp');
              void player.play({ clip: sentence.audio, text: sentence.en });
            }}
          >
            {zh.review.giveUp}
          </Button>
        </div>
      ) : null}
      {done === 'gaveUp' ? <p className="muted">{zh.review.sayAgainLater}</p> : null}
    </div>
  );
}

export function RecallSelfRate({ item, onOutcome }: ExerciseProps) {
  const { bundle, hintProgress, settings } = useApp();
  const answer = answerOf(item);
  const [shown, setShown] = useState(false);
  const [rated, setRated] = useState<Grade | null>(null);
  if (!answer) return null;
  const { sentence } = answer;
  const rate = (g: Grade) => {
    if (rated) return;
    setRated(g);
    onOutcome({ type: 'self', grade: g });
  };
  return (
    <div className="exercise">
      <h2>🤔 {zh.review.recallTitle}</h2>
      <p className="prompt-zh">{sentence.zh}</p>
      {!shown ? (
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            setShown(true);
            void player.play({ clip: sentence.audio, text: sentence.en });
          }}
        >
          {zh.review.showAnswer}
        </Button>
      ) : (
        <>
          <TokenLine
            tokens={sentence.tokens}
            lexicon={bundle.lexicon}
            hintProgress={hintProgress}
            showHints={settings.showHints}
          />
          <PlayRow sentence={sentence} />
          <div className="self-rate-row">
            <Button variant="success" size="lg" disabled={!!rated} onClick={() => rate('good')}>
              {zh.review.selfGood}
            </Button>
            <Button size="lg" disabled={!!rated} onClick={() => rate('hard')}>
              {zh.review.selfHard}
            </Button>
            <Button size="lg" disabled={!!rated} onClick={() => rate('again')}>
              {zh.review.selfAgain}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function PairDiscriminate({ item, seed, onOutcome }: ExerciseProps) {
  if (item.kind !== 'pair') return null;
  return (
    <div className="exercise">
      <h2>👂 {zh.review.pairTitle}</h2>
      <p className="muted">{item.phonics.title}</p>
      <PairQuestion
        pair={item.pair}
        seed={seed}
        onAnswer={(correct) => onOutcome({ type: 'choice', correct })}
      />
    </div>
  );
}
