/**
 * One lesson as a tile: the same look on the Today page and the Course page, so a lesson always
 * looks like a lesson. Opening it always goes to the same lesson player (PartPage).
 */
import type { Part } from '@shared/content/bundle';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';
import { Button } from './ui';

export const KIND_ICON: Record<Part['kind'], string> = {
  learn: '📖',
  practice: '🔑',
  apply: '💬',
  review: '🔁',
  challenge: '🎙️',
};

export type PartStatus = 'done' | 'current' | 'locked';

const STATUS_ICON: Record<PartStatus, string> = { done: '✅', current: '▶️', locked: '○' };

export function PartTile({
  part,
  status,
  from = 'today',
  primary = false,
}: {
  part: Part;
  status: PartStatus;
  /** Where "back" leads from the lesson. */
  from?: 'today' | 'course';
  primary?: boolean;
}) {
  const { navigate } = useApp();
  const open = () => navigate({ name: 'part', partId: part.id, from });
  return (
    <div className={`part-tile ${status}`}>
      <span className="part-status" aria-label={zh.course[status === 'done' ? 'completed' : status]}>
        {STATUS_ICON[status]}
      </span>
      <span className="part-tile-body">
        <span className="muted small">
          {zh.today.weekDay(part.week, part.day)} · {zh.part.kind[part.kind]}
        </span>
        <span className="part-tile-title">
          {KIND_ICON[part.kind]} {part.title}
        </span>
      </span>
      {status === 'done' ? (
        <Button onClick={open}>🔁 {zh.course.again}</Button>
      ) : status === 'current' ? (
        <Button variant={primary ? 'primary' : 'secondary'} size={primary ? 'lg' : 'md'} onClick={open}>
          {zh.course.start}
        </Button>
      ) : null}
    </div>
  );
}
