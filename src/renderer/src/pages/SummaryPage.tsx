/**
 * Everything a unit (or a week) taught on one page, plus two stories that reuse it
 * (docs/decisions/0007-summaries-and-stories.md). Generated from the content; nothing is scheduled here.
 */
import type { StoriesItem, StoryItem, UnitItem } from '@shared/content/bundle';
import { WordList } from '../features/lesson/LearnPart';
import { SentenceList, type ListItem } from '../components/SentenceList';
import { Button, Card, Notice, PageHeader } from '../components/ui';
import { useStopAudioOnUnmount } from '../hooks/usePlayer';
import { zh } from '../i18n/zh';
import { useApp, type Route } from '../state/AppContext';

function storyItems(story: StoryItem, prefix: string): ListItem[] {
  return story.lines.map((l, i) => ({
    key: `${prefix}.${i + 1}`,
    sentence: l,
    ...(l.speaker ? { speaker: l.speaker } : {}),
  }));
}

function Stories({ stories, prefix }: { stories: StoriesItem; prefix: string }) {
  return (
    <>
      <SentenceList
        title={`📚 ${zh.summary.narrative}：${stories.narrative.title}`}
        items={storyItems(stories.narrative, `${prefix}.story1`)}
      />
      <SentenceList
        title={`🎭 ${zh.summary.play}：${stories.dialogue.title}`}
        {...(stories.dialogue.setting
          ? { intro: `${zh.part.dialogueSetting}：${stories.dialogue.setting}` }
          : {})}
        items={storyItems(stories.dialogue, `${prefix}.story2`)}
      />
    </>
  );
}

function replies(unit: UnitItem): ListItem[] {
  const seen = new Set<string>();
  return Object.values(unit.dialogue.nodes).flatMap((n) =>
    n.replies.flatMap((r) => {
      const k = r.en.toLowerCase();
      if (seen.has(k)) return [];
      seen.add(k);
      return [{ key: `${unit.id}.reply.${seen.size}`, sentence: r }];
    }),
  );
}

/** The sentence sections of one unit (shared by the unit and week pages). */
function UnitSentences({ unit }: { unit: UnitItem }) {
  const frames = unit.patterns.frames.map((f) => f.frame).join(' / ');
  return (
    <>
      <SentenceList
        title={`📖 ${zh.summary.chunks}`}
        items={unit.chunks.map((c) => ({
          key: c.id,
          sentence: c,
          ...(c.accept ? { accept: c.accept } : {}),
        }))}
      />
      <SentenceList
        title={`🔑 ${zh.summary.pattern}：${frames}`}
        items={unit.patterns.examples.map((e) => ({
          key: e.id,
          sentence: e,
          scene: e.scene,
          slot: e.pattern.slot,
          ...(e.accept ? { accept: e.accept } : {}),
        }))}
      />
      <SentenceList
        title={`🏠 ${zh.summary.daily}`}
        items={unit.daily.map((d) => ({
          key: d.id,
          sentence: d,
          scene: d.scene,
          slot: d.slot,
          ...(d.accept ? { accept: d.accept } : {}),
        }))}
      />
      <SentenceList title={`💬 ${zh.summary.replies}`} items={replies(unit)} />
    </>
  );
}

function BackButton({ from }: { from: Route }) {
  const { navigate } = useApp();
  return <Button onClick={() => navigate(from)}>← {zh.common.back}</Button>;
}

export function UnitSummaryPage({ unitId, from = { name: 'course' } }: { unitId: string; from?: Route }) {
  const { bundle } = useApp();
  useStopAudioOnUnmount();
  const unit = bundle.units[unitId];
  if (!unit) return <Notice tone="warn">{zh.errors.generic}</Notice>;
  return (
    <div className="page summary">
      <PageHeader
        title={`📄 ${unit.title}`}
        subtitle={`${zh.course.week(unit.week)} · ${unit.titleEn}`}
        actions={<BackButton from={from} />}
      />
      <Card>
        <p className="lead">
          <strong>{zh.part.goal}</strong>
          {unit.goal}
        </p>
        <p className="muted">{zh.summary.help}</p>
      </Card>
      <UnitSentences unit={unit} />
      <WordList keys={[...new Set([...unit.words, ...unit.daily.map((d) => d.word)])]} />
      <Stories stories={unit.stories} prefix={unit.id} />
    </div>
  );
}

export function WeekSummaryPage({ week, from = { name: 'course' } }: { week: number; from?: Route }) {
  const { bundle } = useApp();
  useStopAudioOnUnmount();
  const item = bundle.weeks[String(week)];
  if (!item) return <Notice tone="warn">{zh.errors.generic}</Notice>;
  const units = item.unitIds.map((id) => bundle.units[id]).filter((u) => u !== undefined);
  return (
    <div className="page summary">
      <PageHeader
        title={`📄 ${zh.summary.weekTitle(week)}`}
        subtitle={units.map((u) => u.title).join(' · ')}
        actions={<BackButton from={from} />}
      />
      {units.map((u) => (
        <details key={u.id} className="summary-unit">
          <summary>
            <span className={`kind-pill ${u.kind}`}>
              {u.kind === 'work' ? zh.course.work : zh.course.life}
            </span>{' '}
            {u.title}
          </summary>
          <UnitSentences unit={u} />
        </details>
      ))}
      <Stories stories={item.stories} prefix={`w${week}`} />
    </div>
  );
}
