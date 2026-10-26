/**
 * Three ways to review: today's scheduled cards (FSRS, capped, changes the schedule), and extra
 * practice that never changes the schedule: everything from recent lessons, or anything learned.
 */
import { useEffect, useState } from 'react';
import type { UnitItem } from '@shared/content/bundle';
import { RECENT_DAYS, type PracticeScope, type ReviewCardView } from '@shared/ipc';
import { api, logError } from '../api/client';
import { Button, Card, Loading, Notice, PageHeader } from '../components/ui';
import { ReviewSession, type ReviewSummary } from '../features/review/ReviewSession';
import { useStopAudioOnUnmount } from '../hooks/usePlayer';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';

const RANDOM_COUNT = 20;

interface Session {
  title: string;
  cards: ReviewCardView[];
  /** Today's scheduled review (true) or extra practice (false). */
  scheduled: boolean;
}

interface Overview {
  queue: ReviewCardView[];
  recent: ReviewCardView[];
  units: UnitItem[];
}

export function ReviewPage() {
  const { bundle, navigate } = useApp();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<{ scheduled: boolean; s: ReviewSummary } | null>(null);
  const [reload, setReload] = useState(0);
  useStopAudioOnUnmount();

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.review.getQueue(),
      api.review.getPracticeSet({ scope: 'recent' }),
      api.parts.listCompleted(),
    ])
      .then(([queue, recent, completed]) => {
        const done = new Set(completed);
        const units = Object.values(bundle.units)
          .filter((u) => done.has(`${u.id}:learn`) || done.has(`${u.id}:practice`))
          .sort((a, b) => a.id.localeCompare(b.id));
        if (alive) setOverview({ queue, recent, units });
      })
      .catch((err: unknown) => {
        logError('review overview', err);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [bundle, reload]);

  const practice = async (title: string, scope: PracticeScope) => {
    try {
      const cards = await api.review.getPracticeSet(scope);
      if (cards.length) setSession({ title, cards, scheduled: false });
    } catch (err) {
      logError('review.getPracticeSet', err);
    }
  };

  const backHome = () => {
    setSummary(null);
    setSession(null);
    setReload((n) => n + 1);
  };

  if (failed) return <Notice tone="warn">{zh.errors.generic}</Notice>;

  if (summary) {
    return (
      <div className="page">
        <Card className="finish-card">
          <h1>🎉 {summary.scheduled ? zh.review.finishTitle : zh.review.practiceDone}</h1>
          <p className="lead">
            {summary.scheduled
              ? zh.review.finishBody(summary.s.reviewed, summary.s.correct)
              : zh.review.practiceBody(summary.s.reviewed)}
          </p>
          <div className="row center">
            <Button variant="primary" size="lg" onClick={backHome}>
              {zh.review.backToReview}
            </Button>
            <Button size="lg" onClick={() => navigate({ name: 'today' })}>
              {zh.common.backToToday}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (session) {
    return (
      <div className="page">
        <PageHeader title={session.title} actions={<Button onClick={backHome}>← {zh.common.back}</Button>} />
        <ReviewSession
          cards={session.cards}
          submit={session.scheduled}
          onDone={(s) =>
            // Practice sets count every card; the session only counts submitted (scheduled) ones.
            setSummary({
              scheduled: session.scheduled,
              s: session.scheduled ? s : { ...s, reviewed: session.cards.length },
            })
          }
        />
      </div>
    );
  }

  if (!overview) return <Loading label={zh.common.loading} />;
  const { queue, recent, units } = overview;

  return (
    <div className="page">
      <PageHeader title={zh.review.title} />

      <Card title={`📅 ${zh.review.todayTitle}`}>
        {queue.length ? (
          <>
            <p className="big-number">{zh.review.todayCount(queue.length)}</p>
            <p className="muted small">{zh.review.todayHelp}</p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setSession({ title: zh.review.todayTitle, cards: queue, scheduled: true })}
            >
              {zh.review.start}
            </Button>
          </>
        ) : (
          <>
            <p>{zh.review.empty}</p>
            <p className="muted small">{zh.review.emptyBody}</p>
          </>
        )}
      </Card>

      <Card title={`🌱 ${zh.review.recentTitle}`}>
        <p className="muted small">{zh.review.recentHelp(RECENT_DAYS)}</p>
        {recent.length ? (
          <>
            <p className="big-number">{zh.review.todayCount(recent.length)}</p>
            <Button
              size="lg"
              onClick={() => setSession({ title: zh.review.recentTitle, cards: recent, scheduled: false })}
            >
              {zh.review.start}
            </Button>
          </>
        ) : (
          <p>{zh.review.recentEmpty}</p>
        )}
      </Card>

      <Card title={`📚 ${zh.review.allTitle}`}>
        <p className="muted small">{zh.review.allHelp}</p>
        {units.length ? (
          <>
            <Button
              size="lg"
              onClick={() =>
                void practice(zh.review.random(RANDOM_COUNT), { scope: 'random', count: RANDOM_COUNT })
              }
            >
              {zh.review.random(RANDOM_COUNT)}
            </Button>
            <ul className="unit-practice-list">
              {units.map((u) => (
                <li key={u.id} className="unit-tag">
                  <span className={`kind-pill ${u.kind}`}>
                    {u.kind === 'work' ? zh.course.work : zh.course.life}
                  </span>
                  <span className="part-row-title">{u.title}</span>
                  <Button
                    size="sm"
                    onClick={() =>
                      void practice(zh.review.practiceTitle(u.title), { scope: 'unit', unitId: u.id })
                    }
                  >
                    🔁 {zh.review.unitPractice}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{zh.review.allEmpty}</p>
        )}
      </Card>
    </div>
  );
}
