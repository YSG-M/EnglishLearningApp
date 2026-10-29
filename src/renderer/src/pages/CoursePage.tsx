import { useEffect, useMemo, useState } from 'react';
import type { Part } from '@shared/content/bundle';
import { api, logError } from '../api/client';
import { PartTile, type PartStatus } from '../components/PartTile';
import { Button, Card, Loading, PageHeader } from '../components/ui';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';
import { WeekDownload } from '../../../web/ui/WebSettings';

export function CoursePage() {
  const { bundle, navigate } = useApp();
  const [completed, setCompleted] = useState<Set<string> | null>(null);

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

  const currentId = bundle.parts.find((p) => !p.light && !completed.has(p.id))?.id;
  const status = (p: Part): PartStatus =>
    completed.has(p.id) ? 'done' : p.id === currentId || p.light ? 'current' : 'locked';

  return (
    <div className="page">
      <PageHeader title={zh.course.title} />
      {weeks.map(([week, parts]) => {
        const unitIds = [...new Set(parts.flatMap((p) => (p.kind === 'learn' ? p.unitIds : [])))];
        return (
          <details key={week} className="course-week" open={parts.some((p) => p.id === currentId)}>
            <summary>{zh.course.week(week)}</summary>
            <Card
              title={
                <span className="row">
                  {zh.course.week(week)}
                  {bundle.weeks[String(week)] ? (
                    <Button size="sm" onClick={() => navigate({ name: 'weekSummary', week })}>
                      📄 {zh.course.weekSummary}
                    </Button>
                  ) : null}
                </span>
              }
            >
              <WeekDownload week={week} />
              <div className="unit-tags">
                {unitIds.map((id) => {
                  const u = bundle.units[id];
                  if (!u) return null;
                  return (
                    <span key={id} className="unit-tag">
                      <span className={`kind-pill ${u.kind}`}>
                        {u.kind === 'work' ? zh.course.work : zh.course.life}
                      </span>
                      {u.title}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate({ name: 'unitSummary', unitId: id })}
                      >
                        📄 {zh.course.summary}
                      </Button>
                    </span>
                  );
                })}
              </div>
              <div className="part-list">
                {parts.map((p) => (
                  <PartTile
                    key={p.id}
                    part={p}
                    status={status(p)}
                    from="course"
                    primary={p.id === currentId}
                  />
                ))}
              </div>
            </Card>
          </details>
        );
      })}
    </div>
  );
}
