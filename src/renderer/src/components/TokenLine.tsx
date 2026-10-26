/**
 * A sentence shown word by word, each word with its pronunciation aid underneath.
 *
 * Hint rules (CLAUDE.md · 课程内容规则):
 *  - green / yellow: the pinyin-style 谐音 shown (the 汉字 form is not displayed), until she has said the word correctly HINT_FADE_AFTER times
 *  - red: never a 谐音; a red marker that opens the mouth-position note when tapped
 *  - the global "show hints" setting turns all 谐音 off (red notes remain available on tap)
 * Tapping a word always plays it and shows its Chinese meaning; `showGlosses` shows every meaning.
 */
import { useState } from 'react';
import type { WordEntry } from '@shared/content/bundle';
import type { Token } from '@shared/content/tokenize';
import { HINT_FADE_AFTER } from '@shared/domain/hints';
import { player } from '../audio/player';
import { zh } from '../i18n/zh';

export type HintVisibility = 'shown' | 'faded' | 'off' | 'red' | 'none';

export function hintVisibility(
  entry: WordEntry | undefined,
  correctCount: number,
  showHints: boolean,
): HintVisibility {
  if (!entry) return 'none';
  if (entry.hint.grade === 'red') return 'red';
  if (!showHints) return 'off';
  return correctCount >= HINT_FADE_AFTER ? 'faded' : 'shown';
}

export interface TokenLineProps {
  tokens: Token[];
  lexicon: Record<string, WordEntry>;
  hintProgress: Record<string, number>;
  showHints: boolean;
  /** Words to highlight (from feedback). */
  focusKeys?: string[];
  /** Show each word's Chinese meaning under it. */
  showGlosses?: boolean;
  /** Token range [start, end) that fills a pattern's ___, highlighted so the fixed frame stands out. */
  slot?: [number, number];
  size?: 'md' | 'lg';
}

export function TokenLine({
  tokens,
  lexicon,
  hintProgress,
  showHints,
  focusKeys = [],
  showGlosses = false,
  slot,
  size = 'lg',
}: TokenLineProps) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={`token-line token-line-${size}`}>
      {tokens.map((t, i) => {
        const entry = t.key ? lexicon[t.key] : undefined;
        const vis = hintVisibility(entry, t.key ? (hintProgress[t.key] ?? 0) : 0, showHints);
        const revealed = open === i;
        const focus = !!t.key && focusKeys.includes(t.key);
        const grade = entry?.hint.grade;
        const inSlot = slot ? i >= slot[0] && i < slot[1] : false;
        const frameClass = slot ? (inSlot ? 'slot' : 'frame') : '';
        return (
          <span
            key={i}
            className={`token ${grade ? `grade-${grade}` : ''} ${focus ? 'focus' : ''} ${frameClass}`}
          >
            <button
              type="button"
              className="token-word"
              onClick={() => {
                if (entry) void player.play({ clip: entry.audio, text: entry.text });
                setOpen(revealed ? null : i);
              }}
              title={entry ? `${entry.zh}` : undefined}
            >
              {t.lead}
              {t.surface}
              {t.trail}
            </button>
            <span className="token-hint" data-testid={`hint-${i}`} data-visibility={vis}>
              {vis === 'shown' || ((vis === 'faded' || vis === 'off') && revealed) ? (
                // Learner preference: show the pinyin line only. The 汉字 stays in the content as the authoring reference.
                entry?.hint.pinyin ? (
                  <span className="hint-pinyin">{entry.hint.pinyin}</span>
                ) : null
              ) : vis === 'red' ? (
                <span className="hint-red" aria-label={zh.hints.noHanzi}>
                  ●
                </span>
              ) : vis === 'faded' ? (
                <span className="hint-faded" aria-label={zh.hints.tapToShow}>
                  ·
                </span>
              ) : null}
            </span>
            {showGlosses && entry ? <span className="token-gloss">{entry.zh}</span> : null}
            {revealed && entry ? (
              <span className="token-note" role="note">
                <strong>{entry.text}</strong> {entry.zh}
                {entry.hint.note ? <span className="token-note-body">{entry.hint.note}</span> : null}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
