/** 本周复习: replay each unit's dialogue, then listen through every sentence of the week. */
import { useState } from 'react';
import type { UnitItem } from '@shared/content/bundle';
import { player } from '../../audio/player';
import { PlayRow } from '../../components/AudioButtons';
import { ChineseText } from '../../components/ChineseText';
import { Button, Card, Notice } from '../../components/ui';
import { usePlayingId } from '../../hooks/usePlayer';
import { zh } from '../../i18n/zh';
import { DialoguePlayer } from '../dialogue/DialoguePlayer';
import { Stepper } from './Stepper';

function ListenThrough({ units }: { units: UnitItem[] }) {
  const playing = usePlayingId();
  const chunks = units.flatMap((u) => u.chunks);
  const [running, setRunning] = useState(false);
  const playAll = async () => {
    setRunning(true);
    await player.playSequence(
      chunks.map((c) => ({ clip: c.audio, text: c.en })),
      900,
    );
    setRunning(false);
  };
  return (
    <Card title={`🎧 ${zh.part.reviewDayListen}`}>
      {running ? (
        <Button
          onClick={() => {
            player.stop();
            setRunning(false);
          }}
        >
          ⏹ {zh.part.stopAll}
        </Button>
      ) : (
        <Button variant="primary" onClick={() => void playAll()}>
          ▶ {zh.part.playAll}
        </Button>
      )}
      <ul className="sentence-list">
        {chunks.map((c) => (
          <li key={c.id} className={playing === c.audio ? 'playing' : ''}>
            <p className="en">{c.en}</p>
            <ChineseText text={c.zh} className="small" />
            <PlayRow sentence={c} size="sm" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReviewDayPart({ units, onFinish }: { units: UnitItem[]; onFinish(): void }) {
  const [i, setI] = useState(0);
  const total = units.length + 1;
  const unit = units[i];
  return (
    <Stepper index={i} total={total} onIndex={setI} onFinish={onFinish}>
      {i === 0 ? <Notice>{zh.part.reviewDayIntro}</Notice> : null}
      {unit ? (
        <Card title={`💬 ${unit.title} · ${unit.dialogue.title}`}>
          <DialoguePlayer key={unit.id} dialogue={unit.dialogue} />
        </Card>
      ) : (
        <ListenThrough units={units} />
      )}
    </Stepper>
  );
}
