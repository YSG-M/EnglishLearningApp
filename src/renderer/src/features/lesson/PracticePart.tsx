/** 句型和发音: substitution drill (say each full sentence) → phonics rule → minimal-pair quiz. */
import { useState } from 'react';
import type { UnitItem } from '@shared/content/bundle';
import { Card } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { useApp } from '../../state/AppContext';
import { PairQuiz, PhonicsRule } from '../phonics/PhonicsLesson';
import { SentenceCard } from './SentenceCard';
import { Stepper } from './Stepper';

export function DrillStep({ unit }: { unit: UnitItem }) {
  const [sel, setSel] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const item = unit.drill.items[sel]!;
  return (
    <Card title={`🧩 ${zh.part.drillTitle}`}>
      <p className="drill-pattern">{unit.drill.pattern.replace('___', '______')}</p>
      <p className="muted">
        {unit.drill.zh} · {zh.part.drillHelp}
      </p>
      <div className="fill-row">
        {unit.drill.items.map((it, i) => (
          <button
            key={it.audio}
            type="button"
            className={`fill-chip ${i === sel ? 'active' : ''} ${done.has(i) ? 'done' : ''}`}
            onClick={() => setSel(i)}
          >
            {done.has(i) ? '✓ ' : ''}
            {it.fillZh}
          </button>
        ))}
      </div>
      <SentenceCard
        key={item.audio}
        sentence={item}
        itemId={item.audio}
        onResult={(r) => {
          if (!r.passed) return;
          setDone((d) => new Set(d).add(sel));
          // Move on to the next unfinished fill automatically after a short pause.
          const next = unit.drill.items.findIndex((_, i) => i !== sel && !done.has(i));
          if (next >= 0) setTimeout(() => setSel(next), 1500);
        }}
      />
    </Card>
  );
}

export function PracticePart({ unit, onFinish }: { unit: UnitItem; onFinish(): void }) {
  const { bundle } = useApp();
  const phonics = unit.phonics ? bundle.phonics[unit.phonics] : undefined;
  const steps: ('drill' | 'rule' | 'pairs')[] = [
    'drill',
    ...(phonics ? (['rule'] as const) : []),
    ...(phonics && phonics.pairs.length ? (['pairs'] as const) : []),
  ];
  const [i, setI] = useState(0);
  const step = steps[i];
  return (
    <Stepper index={i} total={steps.length} onIndex={setI} onFinish={onFinish}>
      {step === 'drill' ? <DrillStep unit={unit} /> : null}
      {step === 'rule' && phonics ? <PhonicsRule phonics={phonics} /> : null}
      {step === 'pairs' && phonics ? <PairQuiz phonics={phonics} /> : null}
    </Stepper>
  );
}
