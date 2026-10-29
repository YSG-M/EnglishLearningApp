/** 学新句子: intro → each chunk (listen, see hints, shadow) → grammar tip → 🏠 daily words → word list. */
import { useState } from 'react';
import type { ChunkItem, DailyItem, UnitItem } from '@shared/content/bundle';
import { PlayRow, WordAudio } from '../../components/AudioButtons';
import { ChineseText } from '../../components/ChineseText';
import { Card } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { useApp } from '../../state/AppContext';
import { SentenceCard } from './SentenceCard';
import { Stepper } from './Stepper';

type Step =
  | { type: 'intro' }
  | { type: 'chunk'; index: number }
  | { type: 'grammar' }
  | { type: 'daily'; index: number }
  | { type: 'words' };

export function learnSteps(unit: UnitItem): Step[] {
  return [
    { type: 'intro' },
    ...unit.chunks.map((_, index) => ({ type: 'chunk' as const, index })),
    ...(unit.grammar ? [{ type: 'grammar' as const }] : []),
    ...unit.daily.map((_, index) => ({ type: 'daily' as const, index })),
    { type: 'words' },
  ];
}

export function UnitIntro({ unit }: { unit: UnitItem }) {
  return (
    <Card className="intro-card">
      <p className="muted">{unit.titleEn}</p>
      <h2>{unit.title}</h2>
      <p>
        <strong>{zh.part.goal}</strong>
        {unit.goal}
      </p>
      <p className="muted">{zh.part.listenFirst}</p>
    </Card>
  );
}

export function GrammarTip({ grammar }: { grammar: NonNullable<UnitItem['grammar']> }) {
  return (
    <Card title={`📝 ${zh.part.grammarTitle}：${grammar.title}`}>
      <p className="lead">{grammar.body}</p>
      <ul className="example-list">
        {grammar.examples.map((ex) => (
          <li key={ex.audio}>
            <p className="en">{ex.en}</p>
            <ChineseText text={ex.zh} />
            <PlayRow sentence={ex} size="sm" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function WordList({ keys }: { keys: string[] }) {
  const { bundle, settings } = useApp();
  return (
    <Card title={`🔤 ${zh.part.wordsTitle}`}>
      <p className="muted">{zh.part.wordsHelp}</p>
      <ul className="word-grid">
        {keys.map((k) => {
          const w = bundle.lexicon[k];
          if (!w) return null;
          return (
            <li key={k} className={`word-tile grade-${w.hint.grade}`}>
              <WordAudio clip={w.audio} text={w.text} />
              <span className="word-en">{w.text}</span>
              <span className="word-zh">{w.zh}</span>
              {settings.showHints && w.hint.pinyin ? (
                <span className="hint-pinyin">{w.hint.pinyin}</span>
              ) : null}
              {w.hint.note ? <span className="word-note">{w.hint.note}</span> : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ChunkStep({ unit, chunk }: { unit: UnitItem; chunk: ChunkItem }) {
  const frame = chunk.pattern ? unit.patterns.frames[chunk.pattern.frame] : undefined;
  return (
    <SentenceCard
      sentence={chunk}
      itemId={chunk.id}
      {...(chunk.note ? { note: chunk.note } : {})}
      accept={chunk.accept ?? []}
      {...(chunk.pattern && frame
        ? { slot: chunk.pattern.slot, badge: zh.part.patternBadge(frame.frame) }
        : {})}
    />
  );
}

function DailyStep({ daily }: { daily: DailyItem }) {
  const { bundle } = useApp();
  const word = bundle.lexicon[daily.word];
  return (
    <SentenceCard
      sentence={daily}
      itemId={daily.id}
      scene={daily.scene}
      slot={daily.slot}
      {...(word ? { badge: zh.part.dailyBadge(word.text, word.zh) } : {})}
      {...(daily.note ? { note: daily.note } : {})}
      accept={daily.accept ?? []}
    />
  );
}

export function LearnPart({ unit, onFinish }: { unit: UnitItem; onFinish(): void }) {
  const steps = learnSteps(unit);
  const [i, setI] = useState(0);
  const step = steps[i]!;
  return (
    <Stepper index={i} total={steps.length} onIndex={setI} onFinish={onFinish}>
      {step.type === 'intro' ? <UnitIntro unit={unit} /> : null}
      {step.type === 'chunk' ? (
        <ChunkStep key={step.index} unit={unit} chunk={unit.chunks[step.index]!} />
      ) : null}
      {step.type === 'grammar' && unit.grammar ? <GrammarTip grammar={unit.grammar} /> : null}
      {step.type === 'daily' ? <DailyStep key={step.index} daily={unit.daily[step.index]!} /> : null}
      {step.type === 'words' ? (
        <WordList keys={[...new Set([...unit.words, ...unit.daily.map((d) => d.word)])]} />
      ) : null}
    </Stepper>
  );
}
