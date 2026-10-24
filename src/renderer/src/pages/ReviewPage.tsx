import { useEffect, useState } from 'react';
import type { ReviewCardView } from '@shared/ipc';
import { api, logError } from '../api/client';
import { Button, Card, Loading, Notice, PageHeader } from '../components/ui';
import { ReviewSession, type ReviewSummary } from '../features/review/ReviewSession';
import { useStopAudioOnUnmount } from '../hooks/usePlayer';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';

export function ReviewPage() {
  const { navigate } = useApp();
  const [queue, setQueue] = useState<ReviewCardView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  useStopAudioOnUnmount();

  useEffect(() => {
    api.review
      .getQueue()
      .then(setQueue)
      .catch((err: unknown) => {
        logError('review.getQueue', err);
        setFailed(true);
      });
  }, []);

  if (failed) return <Notice tone="warn">{zh.errors.generic}</Notice>;
  if (!queue) return <Loading label={zh.common.loading} />;

  if (summary) {
    return (
      <div className="page">
        <Card className="finish-card">
          <h1>🎉 {zh.review.finishTitle}</h1>
          <p className="lead">{zh.review.finishBody(summary.reviewed, summary.correct)}</p>
          <Button variant="primary" size="lg" onClick={() => navigate({ name: 'today' })}>
            {zh.common.backToToday}
          </Button>
        </Card>
      </div>
    );
  }

  if (!queue.length) {
    return (
      <div className="page">
        <PageHeader title={zh.review.title} />
        <Card className="finish-card">
          <h2>{zh.review.empty}</h2>
          <p className="muted">{zh.review.emptyBody}</p>
          <Button variant="primary" onClick={() => navigate({ name: 'today' })}>
            {zh.common.backToToday}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={zh.review.title} />
      <ReviewSession cards={queue} onDone={setSummary} />
    </div>
  );
}
