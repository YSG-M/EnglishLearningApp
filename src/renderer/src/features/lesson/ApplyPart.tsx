/** 实战对话: the unit's role-play, then today's real-life task. */
import { useState } from 'react';
import type { UnitItem } from '@shared/content/bundle';
import { Card } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { DialoguePlayer } from '../dialogue/DialoguePlayer';
import { Stepper } from './Stepper';

export function TaskCard({ task }: { task: string }) {
  return (
    <Card title={`🎯 ${zh.part.taskTitle}`} className="card-accent">
      <p className="lead">{task}</p>
      <p className="muted">{zh.part.taskBody}</p>
    </Card>
  );
}

export function ApplyPart({ unit, onFinish }: { unit: UnitItem; onFinish(): void }) {
  const [i, setI] = useState(0);
  return (
    <Stepper index={i} total={2} onIndex={setI} onFinish={onFinish}>
      {i === 0 ? (
        <Card title={`💬 ${unit.dialogue.title}`}>
          <DialoguePlayer dialogue={unit.dialogue} />
        </Card>
      ) : (
        <TaskCard task={unit.task} />
      )}
    </Stepper>
  );
}
