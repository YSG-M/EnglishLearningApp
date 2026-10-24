import { useEffect, useMemo, useState } from 'react';
import type { Part, UnitItem } from '@shared/content/bundle';
import type { ReviewCardView } from '@shared/ipc';
import { api, logError } from '../api/client';
import { Button, Card, Loading, PageHeader } from '../components/ui';
import { ReviewSession } from '../features/review/ReviewSession';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';

const STATUS_ICON = { done: '✅', current: '▶️', locked: '○' } as const;

export function CoursePage() {
  const { bundle, navigate } = useApp();
  const [completed, setCompleted] = useState<Set<string> | null>(null);
  const [practice, setPractice] = useState<{ unit: UnitItem; cards: ReviewCardView[] } | null>(null);

  useEffect(() => {
    api.parts
      .listCompleted()
      .then((ids) => setCompleted(new Set(ids)))
      .catch((err: unknown) => {
        logError('parts.listCompleted', err);
        setCompleted(new Set());
      });
  }, []);

  const weeks = useMemo(() => {
    const map = new Map<number, Part[]>();
    for (const p of bundle.parts) map.set(p.week, [...(map.get(p.week) ?? []), p]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [bundle.parts]);

  if (!completed) return <Loading label={zh.common.loading} />;

  if (practice) {
    return (
      <div className="page">
        <PageHeader
          title={zh.course.practiceTitle(practice.unit.title)}
          actions={<Button onClick={() => setPractice(null)}>← {zh.common.back}</Button>}
        />
        <ReviewSession cards={practice.cards} submit={false} onDone={() => setPractice(null)} />
      </div>
    );
  }

  const currentId = bundle.parts.find((p) => !p.light && !completed.has(p.id))?.id;
  const status = (p: Part): keyof typeof STATUS_ICON =>
    completed.has(p.id) ? 'done' : p.id === currentId || p.light ? 'current' : 'locked';

  const openPractice = async (unit: UnitItem) => {
    try {
      const cards = await api.review.getPracticeSet(unit.id);
      if (cards.length) setPractice({ unit, cards });
    } catch (err) {
      logError('review.getPracticeSet', err);
    }
  };

  return (
    <div className="page">
      <PageHeader title={zh.course.title} />
      {weeks.map(([week, parts]) => {
        const unitIds = [...new Set(parts.flatMap((p) => (p.kind === 'learn' ? p.unitIds : [])))];
        return (
          <Card key={week} title={zh.course.week(week)}>
            <div className="unit-tags">
              {unitIds.map((id) => {
                const u = bundle.units[id];
                if (!u) return null;
                const learned = completed.has(`${id}:learn`);
                return (
                  <span key={id} className="unit-tag">
                    <span className={`kind-pill ${u.kind}`}>
                      {u.kind === 'work' ? zh.course.work : zh.course.life}
                    </span>
                    {u.title}
                    {learned ? (
                      <Button size="sm" onClick={() => void openPractice(u)}>
                        🔁 {zh.course.practice}
                      </Button>
                    ) : null}
                  </span>
                );
              })}
            </div>
            <ul className="part-list">
              {parts.map((p) => {
                const s = status(p);
                return (
                  <li key={p.id} className={`part-row ${s}`}>
                    <span className="part-status" aria-label={zh.course[s === 'done' ? 'completed' : s]}>
                      {STATUS_ICON[s]}
                    </span>
                    <span className="part-row-title">{p.title}</span>
                    {s !== 'locked' ? (
                      <Button size="sm" onClick={() => navigate({ name: 'part', partId: p.id })}>
                        {zh.course.open}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
