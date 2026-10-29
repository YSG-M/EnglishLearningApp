/**
 * 句型课: the pattern frame → each example in its own scene (listen, shadow) → say every scene
 * from memory → phonics rule → minimal-pair quiz. See docs/decisions/0006-pattern-scene-lessons.md.
 */
import { useMemo, useState } from 'react';
import type { PatternExampleItem, UnitItem } from '@shared/content/bundle';
import { stableShuffle } from '@shared/domain/exercise';
import { Button, Card } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { useApp } from '../../state/AppContext';
import { PairQuiz, PhonicsRule } from '../phonics/PhonicsLesson';
import { RecallSelfRate, SpeakFromZh } from '../review/exercises';
import { SentenceCard } from './SentenceCard';
import { Stepper } from './Stepper';

type Step =
  | { type: 'intro' }
  | { type: 'example'; index: number }
  | { type: 'speak' }
  | { type: 'rule' }
  | { type: 'pairs' };

export function PatternIntro({ unit }: { unit: UnitItem }) {
  return (
    <Card title={zh.part.patternTitle} className="intro-card">
      {unit.patterns.frames.map((f) => (
        <div key={f.frame} className="pattern-frame">
          <p className="pattern-frame-en">{f.frame.replace('___', '______')}</p>
          <p className="pattern-frame-zh">{f.zh}</p>
          <p>
            <strong>{zh.part.patternUsage}：</strong>
            {f.usage}
          </p>
        </div>
      ))}
      <p className="muted">{zh.part.patternIntro}</p>
      <p className="muted">{zh.part.patternExamples(unit.patterns.examples.length)}</p>
    </Card>
  );
}

/** Every example once more, shuffled, with only the scene and the Chinese to go on. */
export function SceneSpeak({ unit }: { unit: UnitItem }) {
  const { speech } = useApp();
  const order = useMemo<PatternExampleItem[]>(
    () => stableShuffle(unit.patterns.examples, `${unit.id}:scenes`),
    [unit],
  );
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const example = order[i];
  if (!example) return <p className="done-text">{zh.part.sceneSpeakDone}</p>;
  const item = { kind: 'example' as const, unit, example };
  const Exercise = speech.state === 'ready' ? SpeakFromZh : RecallSelfRate;
  return (
    <Card title={zh.part.sceneSpeakTitle}>
      <p className="muted">{zh.part.sceneSpeakIntro}</p>
      <p className="muted small">{zh.part.sceneSpeakProgress(i + 1, order.length)}</p>
      <Exercise key={example.id} item={item} seed={example.id} onOutcome={() => setAnswered(true)} />
      <div className="row">
        <Button
          variant={answered ? 'primary' : 'ghost'}
          onClick={() => {
            setAnswered(false);
            setI(i + 1);
          }}
        >
          {zh.part.sceneSpeakNext} →
        </Button>
      </div>
    </Card>
  );
}

export function practiceSteps(unit: UnitItem, hasRule: boolean, hasPairs: boolean): Step[] {
  return [
    { type: 'intro' },
    ...unit.patterns.examples.map((_, index) => ({ type: 'example' as const, index })),
    { type: 'speak' },
    ...(hasRule ? [{ type: 'rule' as const }] : []),
    ...(hasPairs ? [{ type: 'pairs' as const }] : []),
  ];
}

export function PracticePart({ unit, onFinish }: { unit: UnitItem; onFinish(): void }) {
  const { bundle } = useApp();
  const phonics = unit.phonics ? bundle.phonics[unit.phonics] : undefined;
  const steps = practiceSteps(unit, !!phonics, !!phonics?.pairs.length);
  const [i, setI] = useState(0);
  const step = steps[i]!;
  const example = step.type === 'example' ? unit.patterns.examples[step.index] : undefined;
  return (
    <Stepper index={i} total={steps.length} onIndex={setI} onFinish={onFinish}>
      {step.type === 'intro' ? <PatternIntro unit={unit} /> : null}
      {example ? (
        <SentenceCard
          key={example.id}
          sentence={example}
          itemId={example.id}
          scene={example.scene}
          slot={example.pattern.slot}
          {...(example.note ? { note: example.note } : {})}
          accept={example.accept ?? []}
        />
      ) : null}
      {step.type === 'speak' ? <SceneSpeak unit={unit} /> : null}
      {step.type === 'rule' && phonics ? <PhonicsRule phonics={phonics} /> : null}
      {step.type === 'pairs' && phonics ? <PairQuiz phonics={phonics} /> : null}
    </Stepper>
  );
}
