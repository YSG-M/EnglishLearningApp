import { useState } from 'react';
import { api, logError } from '../api/client';
import { Button, Card, Notice } from '../components/ui';
import { ApplyPart } from '../features/lesson/ApplyPart';
import { ChallengePart } from '../features/lesson/ChallengePart';
import { LearnPart } from '../features/lesson/LearnPart';
import { PracticePart } from '../features/lesson/PracticePart';
import { ReviewDayPart } from '../features/lesson/ReviewDayPart';
import { useActiveTime } from '../hooks/useActiveTime';
import { useStopAudioOnUnmount } from '../hooks/usePlayer';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';
import { partById } from '../state/content';

export function PartPage({ partId }: { partId: string }) {
  const { bundle, navigate } = useApp();
  const part = partById(bundle, partId);
  const time = useActiveTime(true);
  const [finished, setFinished] = useState<{ cards: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  useStopAudioOnUnmount();

  if (!part) return <Notice tone="warn">{zh.errors.generic}</Notice>;
  const units = part.unitIds.map((id) => bundle.units[id]).filter((u) => u !== undefined);

  const finish = async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      // Earlier time already went through addActiveTime; parts.complete adds whatever is left.
      const activeMs = time.takeUnsent();
      const res = await api.parts.complete({ partId: part.id, activeMs });
      setFinished({ cards: res.cardsIntroduced });
    } catch (err) {
      logError('parts.complete', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (finished) {
    return (
      <div className="page part-finish">
        <Card className="finish-card">
          <h1>🎉 {zh.part.finishTitle}</h1>
          <p className="lead">{zh.part.finishBody(finished.cards)}</p>
          <Button variant="primary" size="lg" onClick={() => navigate({ name: 'today' })}>
            {zh.common.backToToday}
          </Button>
        </Card>
      </div>
    );
  }

  const onFinish = () => void finish();
  let body;
  if (part.kind === 'challenge') {
    const challenge = part.challengeId ? bundle.challenges[part.challengeId] : undefined;
    body = challenge ? (
      <ChallengePart challenge={challenge} onFinish={onFinish} onActivity={time.poke} />
    ) : null;
  } else if (part.kind === 'review') {
    body = <ReviewDayPart units={units} onFinish={onFinish} />;
  } else {
    const unit = units[0];
    if (!unit) body = null;
    else if (part.kind === 'learn') body = <LearnPart unit={unit} onFinish={onFinish} />;
    else if (part.kind === 'practice') body = <PracticePart unit={unit} onFinish={onFinish} />;
    else body = <ApplyPart unit={unit} onFinish={onFinish} />;
  }

  return (
    <div className="page part">
      <div className="part-topbar">
        <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'today' })}>
          ← {zh.common.back}
        </Button>
        <span className="muted small">
          {zh.today.weekDay(part.week, part.day)} · {zh.part.kind[part.kind]}
        </span>
      </div>
      <h1 className="part-heading">{part.title}</h1>
      {saving ? <Notice>{zh.common.loading}</Notice> : null}
      {saveFailed ? (
        <Notice tone="warn">
          {zh.errors.generic} <Button onClick={onFinish}>{zh.common.retry}</Button>
        </Notice>
      ) : null}
      {body ?? <Notice tone="warn">{zh.errors.generic}</Notice>}
    </div>
  );
}
