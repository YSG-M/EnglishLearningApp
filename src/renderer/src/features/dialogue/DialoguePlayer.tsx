/**
 * Branching role-play. The other person speaks (audio), she says one of the offered replies,
 * and the recogniser decides which branch she took (best match ≥ CHOOSE_SCORE). If it is not
 * sure, or recognition is unavailable, she taps the reply she meant — the dialogue never gets stuck.
 */
import { useEffect, useRef, useState } from 'react';
import type { DialogueItem, DialogueNodeItem, DialogueReplyItem } from '@shared/content/bundle';
import { PlayButton } from '../../components/AudioButtons';
import { ChineseText } from '../../components/ChineseText';
import { SpeakPanel, type SpeakResult } from '../../components/SpeakPanel';
import { TokenLine } from '../../components/TokenLine';
import { Button } from '../../components/ui';
import { zh } from '../../i18n/zh';
import { useApp } from '../../state/AppContext';

export const CHOOSE_SCORE = 0.5;

interface Turn {
  node: DialogueNodeItem;
  reply?: DialogueReplyItem;
}

export function DialoguePlayer({ dialogue, onComplete }: { dialogue: DialogueItem; onComplete?(): void }) {
  const { bundle, hintProgress, settings } = useApp();
  const [turns, setTurns] = useState<Turn[]>(() => {
    const start = dialogue.nodes[dialogue.start];
    return start ? [{ node: start }] : [];
  });
  const [unsure, setUnsure] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const completed = useRef(false);
  const current = turns[turns.length - 1];
  const node = current?.node;
  const ended = !!node && node.replies.length === 0;

  useEffect(() => {
    if (ended && !completed.current) {
      completed.current = true;
      onComplete?.();
    }
  }, [ended, onComplete]);

  const choose = (reply: DialogueReplyItem) => {
    const next = dialogue.nodes[reply.next];
    setUnsure(false);
    setAttempted(false);
    setTurns((ts) => [
      ...ts.slice(0, -1),
      { node: ts[ts.length - 1]!.node, reply },
      ...(next ? [{ node: next }] : []),
    ]);
  };

  const onResult = (r: SpeakResult) => {
    setAttempted(true);
    if (!node || r.selfRated) {
      if (r.selfRated) setUnsure(true);
      return;
    }
    if (r.score !== null && r.score >= CHOOSE_SCORE) {
      const reply = node.replies[r.bestIndex];
      if (reply) setTimeout(() => choose(reply), 1200);
    } else setUnsure(true);
  };

  const restart = () => {
    const start = dialogue.nodes[dialogue.start];
    completed.current = false;
    setTurns(start ? [{ node: start }] : []);
    setUnsure(false);
    setAttempted(false);
  };

  return (
    <div className="dialogue">
      <p className="muted">
        🎬 <strong>{zh.part.dialogueSetting}：</strong>
        {dialogue.setting}
      </p>
      <div className="chat">
        {turns.map((t, i) => {
          const content = (
            <>
              <div className="bubble npc">
                <span className="bubble-name">{dialogue.npcName}</span>
                <p className="en">{t.node.npc.en}</p>
                <ChineseText text={t.node.npc.zh} className="small" />
                <PlayButton clip={t.node.npc.audio} text={t.node.npc.en} size="sm" />
              </div>
              {t.reply ? (
                <div className="bubble me">
                  <p className="en">{t.reply.en}</p>
                  <p className="zh small">{t.reply.zh}</p>
                </div>
              ) : null}
            </>
          );
          return i === turns.length - 1 ? (
            <div key={`${t.node.id}-${i}`}>{content}</div>
          ) : (
            <details key={`${t.node.id}-${i}`}>
              <summary>之前的对话 · 第 {i + 1} 轮</summary>
              {content}
            </details>
          );
        })}
      </div>

      {node && !ended ? (
        <div className="your-turn">
          <h3>🗣 {zh.part.dialogueYourTurn}</h3>
          <ul className="reply-list">
            {node.replies.map((r) => (
              <li key={r.audio} className="reply-option">
                <TokenLine
                  tokens={r.tokens}
                  lexicon={bundle.lexicon}
                  hintProgress={hintProgress}
                  showHints={settings.showHints}
                  size="md"
                />
                <ChineseText text={r.zh} className="small" />
                <div className="row">
                  <PlayButton clip={r.audio} text={r.en} size="sm" />
                  {attempted || unsure ? (
                    <Button size="sm" onClick={() => choose(r)}>
                      👆 {zh.part.dialogueTapReply}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <SpeakPanel
            key={node.id + turns.length}
            targets={node.replies.map((r) => r.en)}
            tokens={node.replies.flatMap((r) => r.tokens)}
            itemId={node.replies[0]?.audio ?? node.id}
            onResult={onResult}
            compact
          />
          {unsure ? <p className="muted">{zh.part.dialogueNotSure}</p> : null}
        </div>
      ) : null}

      {ended ? (
        <div className="dialogue-end">
          <p className="success-text">👏 {zh.part.dialogueEnd}</p>
          <Button onClick={restart}>🔁 {zh.part.dialogueReplay}</Button>
        </div>
      ) : null}
    </div>
  );
}
