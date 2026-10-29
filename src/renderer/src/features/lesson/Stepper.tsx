import type { ReactNode } from 'react';
import { Button, StepDots } from '../../components/ui';
import { zh } from '../../i18n/zh';

/** Linear step navigation shared by the lesson parts: dots, content, back / next. */
export function Stepper({
  index,
  total,
  onIndex,
  onFinish,
  children,
  nextLabel,
}: {
  index: number;
  total: number;
  onIndex(i: number): void;
  onFinish(): void;
  children: ReactNode;
  nextLabel?: string;
}) {
  const last = index >= total - 1;
  return (
    <div className="stepper">
      <StepDots index={index} total={total} />
      <div className="step-body">{children}</div>
      <div className="step-nav">
        <Button variant="ghost" disabled={index === 0} onClick={() => onIndex(index - 1)}>
          ← {zh.common.back}
        </Button>
        <span className="muted small">{zh.part.stepOf(index + 1, total)}</span>
        {last ? (
          <Button variant="primary" size="lg" onClick={onFinish}>
            ✓ {zh.common.done}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={() => onIndex(index + 1)}>
            {nextLabel ?? zh.common.next} →
          </Button>
        )}
      </div>
    </div>
  );
}
