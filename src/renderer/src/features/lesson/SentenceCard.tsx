/**
 * One sentence to learn and say: words with hints, Chinese, note, ▶ / 🐢, and the speak panel.
 * Used by the learn part (chunks), the pattern lesson (examples) and anywhere a sentence is shadowed.
 */
import { useEffect, useState } from 'react';
import type { SpokenSentence } from '@shared/content/bundle';
import { player } from '../../audio/player';
import { PlayRow } from '../../components/AudioButtons';
import { ChineseText } from '../../components/ChineseText';
import { SpeakPanel, type SpeakResult } from '../../components/SpeakPanel';
import { TokenLine } from '../../components/TokenLine';
import { Button } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { useApp } from '../../state/AppContext';

export function SentenceCard({
  sentence,
  itemId,
  note,
  accept = [],
  scene,
  slot,
  badge,
  autoPlay = true,
  onResult,
}: {
  sentence: SpokenSentence;
  itemId: string;
  note?: string;
  accept?: string[];
  /** 🎬 The situation this sentence is used in. */
  scene?: string;
  /** Pattern slot to highlight. */
  slot?: [number, number];
  /** One-line label above the sentence, e.g. "uses tomorrow's pattern". */
  badge?: string;
  autoPlay?: boolean;
  onResult?(r: SpeakResult): void;
}) {
  const { bundle, hintProgress, settings, updateSettings } = useApp();
  const [focus, setFocus] = useState<string[]>([]);

  useEffect(() => {
    if (!autoPlay) return;
    // Hear it before seeing how to say it.
    const t = setTimeout(() => void player.play({ clip: sentence.audio, text: sentence.en }), 300);
    return () => clearTimeout(t);
  }, [autoPlay, sentence.audio, sentence.en]);

  return (
    <div className="sentence-card">
      {scene ? (
        <p className="scene">
          <span className="scene-label">{zh.part.scene}</span>
          {scene}
        </p>
      ) : null}
      {badge ? <p className="pattern-badge">{badge}</p> : null}
      <TokenLine
        tokens={sentence.tokens}
        lexicon={bundle.lexicon}
        hintProgress={hintProgress}
        showHints={settings.showHints}
        showGlosses={settings.showGlosses}
        focusKeys={focus}
        {...(slot ? { slot } : {})}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void updateSettings({ showGlosses: !settings.showGlosses })}
      >
        {settings.showGlosses ? zh.part.glossesOff : zh.part.glossesOn}
      </Button>
      <ChineseText text={sentence.zh} />
      {note ? (
        <p className="note">
          💡 <strong>{zh.part.note}：</strong>
          {note}
        </p>
      ) : null}
      <PlayRow sentence={sentence} size="lg" />
      <h3 className="shadow-title">🎤 {zh.part.shadowTitle}</h3>
      <SpeakPanel
        key={itemId}
        targets={[sentence.en, ...accept]}
        tokens={sentence.tokens}
        itemId={itemId}
        reference={{ clip: sentence.audio, text: sentence.en }}
        onFocus={setFocus}
        {...(onResult ? { onResult } : {})}
      />
    </div>
  );
}
