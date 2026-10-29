/**
 * Runs a list of review cards one at a time.
 *
 * Each card's outcome is graded and submitted immediately (closing the app mid-session loses
 * nothing). Cards she missed come back once at the end of the session as unscored practice:
 * seeing it again a few minutes later helps, and the schedule has already been updated.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReviewCardView } from '@shared/ipc';
import { gradeOutcome, isCorrect, type ExerciseOutcome } from '@shared/domain/exercise';
import { api, logError } from '../../api/client';
import { Button, Card, Notice } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { useApp } from '../../state/AppContext';
import { resolveItem } from '../../state/content';
import { ListenChoose, PairDiscriminate, RecallSelfRate, SpeakFromZh } from './exercises';

/** A card reviewed for longer than this was probably left open: don't count all of it. */
const MAX_CARD_MS = 120_000;

interface QueueEntry {
  card: ReviewCardView;
  practice: boolean;
}

export interface ReviewSummary {
  reviewed: number;
  correct: number;
}

export function ReviewSession({
  cards,
  onDone,
  submit = true,
}: {
  cards: ReviewCardView[];
  onDone(summary: ReviewSummary): void;
  /** false for extra practice sets that must not change the schedule. */
  submit?: boolean;
}) {
  const { bundle, speech } = useApp();
  const [queue, setQueue] = useState<QueueEntry[]>(() => cards.map((card) => ({ card, practice: !submit })));
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<ExerciseOutcome | null>(null);
  const submitting = useRef(false);
  const stats = useRef<ReviewSummary>({ reviewed: 0, correct: 0 });
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, [index]);

  const entry = queue[index];
  if (!entry) return null;
  const { card } = entry;
  const item = resolveItem(bundle, card.kind, card.itemId);

  const next = () => {
    setAnswered(false);
    if (index + 1 >= queue.length) onDone(stats.current);
    else setIndex(index + 1);
  };

  const saveOutcome = async (o: ExerciseOutcome) => {
    if (submitting.current || answered) return;
    const grade = gradeOutcome(o);
    if (!entry.practice && submit) {
      submitting.current = true;
      setSaving(true);
      setPending(null);
      try {
        await api.review.submit({
          cardId: card.cardId,
          exercise: card.exercise,
          grade,
          activeMs: Math.min(MAX_CARD_MS, Date.now() - started.current),
        });
      } catch (err) {
        logError('review.submit', err);
        setPending(o);
        return;
      } finally {
        submitting.current = false;
        setSaving(false);
      }
    }
    setAnswered(true);
    if (entry.practice) return;
    stats.current.reviewed++;
    if (isCorrect(grade)) stats.current.correct++;
    else setQueue((q) => [...q, { card, practice: true }]);
  };
  const onOutcome = (o: ExerciseOutcome) => {
    void saveOutcome(o);
  };

  // Speech can drop out mid-session (model crashed): fall back to self-rating for speaking cards.
  const exercise =
    card.exercise === 'speak-from-zh' && speech.state !== 'ready' ? 'recall-self-rate' : card.exercise;
  const seed = `${card.cardId}:${card.reps}:${entry.practice ? 'p' : 's'}`;
  const key = `${index}:${card.cardId}`;

  return (
    <div className="review-session">
      <div className="review-progress">
        <div className="bar">
          <div className="bar-fill" style={{ width: `${Math.round((index / queue.length) * 100)}%` }} />
        </div>
        <span className="muted small">{zh.review.progress(index + 1, queue.length)}</span>
      </div>
      <Card className="exercise-card">
        {!item ? (
          <p className="muted">{zh.errors.generic}</p>
        ) : exercise === 'listen-choose' ? (
          <ListenChoose key={key} item={item} seed={seed} onOutcome={onOutcome} />
        ) : exercise === 'speak-from-zh' ? (
          <SpeakFromZh key={key} item={item} seed={seed} onOutcome={onOutcome} />
        ) : exercise === 'pair-discriminate' ? (
          <PairDiscriminate key={key} item={item} seed={seed} onOutcome={onOutcome} />
        ) : (
          <RecallSelfRate key={key} item={item} seed={seed} onOutcome={onOutcome} />
        )}
      </Card>
      {pending ? (
        <Notice tone="warn">
          学习记录未保存，请检查本机空间后重试。
          <Button onClick={() => void saveOutcome(pending)}>重试保存</Button>
        </Notice>
      ) : null}
      <div className="step-nav">
        <span />
        <Button
          variant="primary"
          size="lg"
          disabled={saving || !!pending || (!answered && !!item)}
          onClick={next}
        >
          {zh.review.next} →
        </Button>
      </div>
    </div>
  );
}
