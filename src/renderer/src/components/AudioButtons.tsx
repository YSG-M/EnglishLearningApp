import type { Sentence } from '@shared/content/bundle';
import { player } from '../audio/player';
import { usePlayingId } from '../hooks/usePlayer';
import { useApp } from '../state/AppContext';
import { zh } from '../i18n/zh';
import { Button } from './ui';

export function PlayButton({
  clip,
  text,
  slow = false,
  label,
  size = 'md',
}: {
  clip: string;
  text: string;
  slow?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { settings } = useApp();
  const playing = usePlayingId();
  const id = `${clip}${slow ? ':slow' : ''}`;
  const active = playing === id;
  return (
    <Button
      size={size}
      variant={active ? 'primary' : 'secondary'}
      aria-pressed={active}
      onClick={() =>
        active ? player.stop() : void player.play({ clip, text, id, rate: slow ? settings.slowRate : 1 })
      }
    >
      {slow ? '🐢' : '▶'} {label ?? (slow ? zh.common.slow : zh.common.play)}
    </Button>
  );
}

/** ▶ normal + 🐢 slow for one sentence. */
export function PlayRow({ sentence, size = 'md' }: { sentence: Sentence; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className="play-row">
      <PlayButton clip={sentence.audio} text={sentence.en} size={size} />
      <PlayButton clip={sentence.audio} text={sentence.en} slow size={size} />
    </div>
  );
}

/** Small round speaker button for a single word. */
export function WordAudio({ clip, text }: { clip: string; text: string }) {
  const playing = usePlayingId();
  return (
    <button
      type="button"
      className={`icon-btn ${playing === clip ? 'active' : ''}`}
      aria-label={`${zh.common.play} ${text}`}
      onClick={() => void player.play({ clip, text })}
    >
      🔊
    </button>
  );
}
