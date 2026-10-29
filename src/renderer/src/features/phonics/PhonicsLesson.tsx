import { useState } from 'react';
import type { PhonicsItem } from '@shared/content/bundle';
import { PlayRow } from '../../components/AudioButtons';
import { Button, Card } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { PairQuestion } from './PairQuestion';

export function PhonicsRule({ phonics }: { phonics: PhonicsItem }) {
  return (
    <Card title={`🔡 ${zh.part.phonicsTitle}：${phonics.title}`}>
      <p className="lead">{phonics.rule}</p>
      {phonics.mouth ? (
        <p className="note">
          👄 <strong>{zh.part.phonicsMouth}：</strong>
          {phonics.mouth}
        </p>
      ) : null}
      <h3>{zh.part.phonicsExamples}</h3>
      <ul className="example-list">
        {phonics.examples.map((ex) => (
          <li key={ex.audio}>
            <span className="en">{ex.en}</span> <span className="muted">{ex.zh}</span>
            <PlayRow sentence={ex} size="sm" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** All pairs of a phonics unit, one after another. */
export function PairQuiz({ phonics }: { phonics: PhonicsItem }) {
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(0);
  const pair = phonics.pairs[i];
  if (!pair) {
    return (
      <Card title={`👂 ${zh.part.pairQuizTitle}`}>
        <p className="lead">
          ✅ {correct} / {phonics.pairs.length}
        </p>
      </Card>
    );
  }
  return (
    <Card title={`👂 ${zh.part.pairQuizTitle}`}>
      <p className="muted small">
        {i + 1} / {phonics.pairs.length}
      </p>
      <PairQuestion
        key={pair.id}
        pair={pair}
        seed={`${pair.id}:lesson`}
        onAnswer={(ok) => {
          setAnswered(true);
          if (ok) setCorrect((c) => c + 1);
        }}
      />
      {answered ? (
        <Button
          variant="primary"
          onClick={() => {
            setAnswered(false);
            setI(i + 1);
          }}
        >
          {zh.common.next} →
        </Button>
      ) : null}
    </Card>
  );
}
