/**
 * A list of sentences on one page, with "▶ play all": used by the unit / week summaries and the stories.
 * Every line keeps what the lesson has (pinyin, tap for meaning, ▶ / 🐢) and can be shadowed on demand.
 */
import { useState, type ReactNode } from 'react';
import type { SpokenSentence } from '@shared/content/bundle';
import { player } from '../audio/player';
import { usePlayingId } from '../hooks/usePlayer';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';
import { PlayRow } from './AudioButtons';
import { ChineseText } from './ChineseText';
import { SpeakPanel } from './SpeakPanel';
import { TokenLine } from './TokenLine';
import { Button, Card } from './ui';

export interface ListItem {
  key: string;
  sentence: SpokenSentence;
  scene?: string;
  speaker?: string;
  slot?: [number, number];
  accept?: string[];
}

function Line({ item }: { item: ListItem }) {
  const { bundle, hintProgress, settings } = useApp();
  const playing = usePlayingId();
  const [speaking, setSpeaking] = useState(false);
  const { sentence } = item;
  return (
    <li className={playing === sentence.audio ? 'playing' : ''}>
      {item.scene ? <p className="muted small">🎬 {item.scene}</p> : null}
      {item.speaker ? <p className="speaker">{item.speaker}：</p> : null}
      <TokenLine
        tokens={sentence.tokens}
        lexicon={bundle.lexicon}
        hintProgress={hintProgress}
        showHints={settings.showHints}
        showGlosses={settings.showGlosses}
        size="md"
        {...(item.slot ? { slot: item.slot } : {})}
      />
      <ChineseText text={sentence.zh} className="small" />
      <div className="row">
        <PlayRow sentence={sentence} size="sm" />
        <Button size="sm" variant={speaking ? 'primary' : 'ghost'} onClick={() => setSpeaking(!speaking)}>
          🎤 {zh.summary.shadow}
        </Button>
      </div>
      {speaking ? (
        <SpeakPanel
          targets={[sentence.en, ...(item.accept ?? [])]}
          tokens={sentence.tokens}
          itemId={item.key}
          reference={{ clip: sentence.audio, text: sentence.en }}
        />
      ) : null}
    </li>
  );
}

export function SentenceList({
  title,
  intro,
  items,
}: {
  title: ReactNode;
  intro?: ReactNode;
  items: ListItem[];
}) {
  const [running, setRunning] = useState(false);
  const playAll = async () => {
    setRunning(true);
    await player.playSequence(
      items.map((i) => ({ clip: i.sentence.audio, text: i.sentence.en })),
      700,
    );
    setRunning(false);
  };
  if (!items.length) return null;
  return (
    <Card title={title}>
      {intro ? <p className="muted">{intro}</p> : null}
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
        {items.map((i) => (
          <Line key={i.key} item={i} />
        ))}
      </ul>
    </Card>
  );
}
