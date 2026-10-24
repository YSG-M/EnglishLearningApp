import { useEffect, useState } from 'react';
import type { Part } from '@shared/content/bundle';
import type { TodayView } from '@shared/ipc';
import { api, logError } from '../api/client';
import { Button, Card, Loading, Notice } from '../components/ui';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';

const KIND_ICON: Record<Part['kind'], string> = {
  learn: '📖',
  practice: '🧩',
  apply: '💬',
  review: '🔁',
  challenge: '🎙️',
};

export function TodayPage() {
  const { settings, navigate } = useApp();
  const [view, setView] = useState<TodayView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.today
      .get()
      .then((v) => alive && setView(v))
      .catch((err: unknown) => {
        logError('today.get', err);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <Notice tone="warn">{zh.errors.generic}</Notice>;
  if (!view) return <Loading label={zh.common.loading} />;

  const { plan, streak } = view;
  const openPart = (p: Part) => navigate({ name: 'part', partId: p.id });
  const doneTodayStep = view.partsCompletedToday > 0 && !plan.newPartRecommended;

  return (
    <div className="page today">
      <header className="today-hero">
        <h1>{zh.today.greeting(settings.learnerName, new Date().getHours())}</h1>
        <p className="hero-days">
          {streak.totalDays > 0 ? zh.today.totalDays(streak.totalDays) : zh.today.totalDaysZero}
        </p>
        <div className="hero-badges">
          {streak.current > 0 ? <span className="badge">🔥 {zh.today.streak(streak.current)}</span> : null}
          <span className="badge" title={zh.today.restCardsHelp}>
            🛌 {zh.today.restCards(streak.restCards)}
          </span>
          {view.dayCounted ? <span className="badge badge-success">{zh.today.dayCounted}</span> : null}
          {view.activeMsToday >= 60_000 ? (
            <span className="badge">⏱ {zh.today.activeMinutes(Math.round(view.activeMsToday / 60_000))}</span>
          ) : null}
        </div>
      </header>

      {view.restCardsUsedToday > 0 ? (
        <Notice tone="success">{zh.today.restCardUsed(view.restCardsUsedToday)}</Notice>
      ) : null}
      {view.streakResetToday ? <Notice>{zh.today.streakReset}</Notice> : null}
      {plan.welcomeBack ? <Notice>{zh.today.welcomeBack}</Notice> : null}

      <div className="today-grid">
        <Card title={`🔁 ${zh.today.reviewsTitle}`}>
          {plan.reviewIds.length > 0 ? (
            <>
              <p className="big-number">{zh.today.reviewsCount(plan.reviewIds.length)}</p>
              {plan.deferredReviews > 0 ? <p className="muted small">{zh.today.deferred}</p> : null}
              <Button variant="primary" size="lg" onClick={() => navigate({ name: 'review' })}>
                {zh.today.startReview}
              </Button>
            </>
          ) : (
            <p>{view.reviewsDoneToday > 0 ? zh.today.reviewsNone : zh.today.reviewsNoneYet}</p>
          )}
        </Card>

        {plan.lightParts.map((p) => (
          <Card
            key={p.id}
            title={`${KIND_ICON.challenge} ${zh.today.challengeTitle}`}
            className="card-accent"
          >
            <p className="part-title">{p.title}</p>
            <p className="muted">{zh.today.challengeHint}</p>
            <Button variant="primary" size="lg" onClick={() => openPart(p)}>
              {zh.common.start}
            </Button>
          </Card>
        ))}

        <Card title={`✨ ${zh.today.nextTitle}`}>
          {!plan.nextPart ? (
            <p>{zh.today.courseFinished}</p>
          ) : (
            <>
              <p className="muted small">{zh.today.weekDay(plan.nextPart.week, plan.nextPart.day)}</p>
              <p className="part-title">
                {KIND_ICON[plan.nextPart.kind]} {plan.nextPart.title}
              </p>
              {plan.pace === 'consolidate' && view.partsCompletedToday === 0 ? (
                <>
                  <Notice tone="warn">{zh.today.paceConsolidate}</Notice>
                  <Button onClick={() => openPart(plan.nextPart!)}>{zh.today.learnAnyway}</Button>
                </>
              ) : doneTodayStep ? (
                <>
                  <p className="done-text">{zh.today.doneToday}</p>
                  <p className="muted">{plan.pace === 'fast' ? zh.today.paceFast : zh.today.doneTodayBody}</p>
                  <Button onClick={() => openPart(plan.nextPart!)}>{zh.today.learnMore}</Button>
                </>
              ) : (
                <>
                  {plan.pace === 'fast' && view.partsCompletedToday > 0 ? (
                    <p className="muted">{zh.today.paceFast}</p>
                  ) : null}
                  <Button variant="primary" size="lg" onClick={() => openPart(plan.nextPart!)}>
                    {zh.today.startPart}
                  </Button>
                </>
              )}
            </>
          )}
        </Card>
      </div>

      <p className="muted small center">{zh.today.minimum}</p>
    </div>
  );
}
