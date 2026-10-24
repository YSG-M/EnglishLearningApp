/**
 * "Say it" panel: record → recognise → compare → one praise + one tip.
 *
 * When speech recognition is not available (no model, still loading, error) it degrades to a
 * self-check: she can still record, listen back and compare with the original, then judge herself.
 * The lesson never blocks on the recogniser.
 */
import { useEffect, useRef, useState } from 'react';
import type { Token } from '@shared/content/tokenize';
import { buildFeedback, type Feedback } from '@shared/domain/feedback';
import { bestMatch } from '@shared/domain/speechMatch';
import { api, errorCode, logError } from '../api/client';
import type { Recording } from '../audio/recorder';
import { player } from '../audio/player';
import { wavBlobUrl } from '../audio/wav';
import { useRecorder } from '../hooks/useRecorder';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';
import { Button } from './ui';

export interface SpeakResult {
  passed: boolean;
  /** null when she rated herself. */
  score: number | null;
  attempts: number;
  /** Which of `targets` matched best (0 when self-rated). */
  bestIndex: number;
  heardText: string;
  selfRated: boolean;
}

export interface SpeakPanelProps {
  /** Acceptable sentences; the first is the one shown/played. */
  targets: string[];
  /** Tokens of the main sentence, for word-level feedback. */
  tokens: Token[];
  /** Files the recording (chunk id or clip key). */
  itemId: string;
  keep?: boolean;
  /** Original audio for "原音 + 我的". */
  reference?: { clip: string; text: string };
  onResult?(r: SpeakResult): void;
  /** Called with the feedback focus words so the sentence can highlight them. */
  onFocus?(keys: string[]): void;
  compact?: boolean;
}

export function SpeakPanel({
  targets,
  tokens,
  itemId,
  keep = true,
  reference,
  onResult,
  onFocus,
  compact,
}: SpeakPanelProps) {
  const { speech, settings, bundle, recordCorrectWords, refreshSpeech } = useApp();
  const rec = useRecorder();
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [ownUrl, setOwnUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [awaitingSelf, setAwaitingSelf] = useState(false);
  const attempts = useRef(0);
  const [tried, setTried] = useState(false);
  const selfMode = speech.state !== 'ready';

  useEffect(() => () => void (ownUrl && URL.revokeObjectURL(ownUrl)), [ownUrl]);

  const keepLocal = (r: Recording) => {
    setOwnUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return wavBlobUrl(r.samples, r.sampleRate);
    });
  };

  const handleRecognized = async (text: string, recordingId: string | null) => {
    const { index, result } = bestMatch(targets, text);
    const fb = buildFeedback(result, tokens, bundle.lexicon, attempts.current);
    setFeedback(fb);
    setHeard(text);
    onFocus?.(fb.focusKeys);
    if (recordingId) {
      void api.speech
        .annotateRecording({ recordingId, score: result.score, transcript: text })
        .catch((e: unknown) => logError('annotateRecording', e));
    }
    if (result.passed) void recordCorrectWords([...new Set(tokens.flatMap((t) => (t.key ? [t.key] : [])))]);
    onResult?.({
      passed: result.passed,
      score: result.score,
      attempts: attempts.current,
      bestIndex: Math.max(0, index),
      heardText: text,
      selfRated: false,
    });
  };

  const start = async () => {
    setFeedback(null);
    setHeard(null);
    setFailed(false);
    setAwaitingSelf(false);
    const r = await rec.record({ silenceMs: settings.silenceMs });
    if (!r) return;
    keepLocal(r);
    attempts.current += 1;
    setTried(true);
    if (selfMode) {
      setAwaitingSelf(true);
      return;
    }
    if (!r.hadSpeech) {
      setFeedback({ tone: 'silent', praise: zh.speak.noSpeech, focusKeys: [] });
      return;
    }
    setProcessing(true);
    try {
      const res = await api.speech.recognize({ samples: r.samples, sampleRate: 16000, itemId, keep });
      await handleRecognized(res.text, res.recordingId);
    } catch (err) {
      const code = errorCode(err);
      logError('recognize', err);
      if (code === 'SPEECH_UNAVAILABLE') {
        await refreshSpeech();
        setAwaitingSelf(true);
      } else setFailed(true);
    } finally {
      setProcessing(false);
    }
  };

  const selfRate = (passed: boolean) => {
    setAwaitingSelf(false);
    if (passed) void recordCorrectWords([...new Set(tokens.flatMap((t) => (t.key ? [t.key] : [])))]);
    onResult?.({
      passed,
      score: null,
      attempts: attempts.current,
      bestIndex: 0,
      heardText: '',
      selfRated: true,
    });
  };

  const recording = rec.state === 'recording';
  return (
    <div className={`speak-panel ${compact ? 'compact' : ''}`}>
      {selfMode && !compact ? (
        <p className="muted small">
          {zh.speak.selfModeTitle}：{speech.message ?? zh.speak.selfModeBody}
        </p>
      ) : null}
      <div className="speak-controls">
        {recording ? (
          <Button variant="warn" size="lg" onClick={rec.stop}>
            ⏹ {zh.speak.stop}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={() => void start()} disabled={processing}>
            🎤 {tried ? zh.common.retry : zh.speak.record}
          </Button>
        )}
        {ownUrl && !recording ? (
          <>
            <Button onClick={() => void player.play({ url: ownUrl, id: 'own' })}>
              👂 {zh.common.playOwn}
            </Button>
            {reference ? (
              <Button
                onClick={() =>
                  void player.playSequence([
                    { clip: reference.clip, text: reference.text },
                    { url: ownUrl, id: 'own' },
                  ])
                }
              >
                ▶▶ {zh.common.compare}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {recording ? (
        <div className="level-meter" aria-label={zh.speak.recording}>
          <div className="level-fill" style={{ width: `${Math.round(rec.level * 100)}%` }} />
          <span className="level-label">{zh.speak.recording}</span>
        </div>
      ) : null}
      {processing ? <p className="muted">{zh.speak.processing}</p> : null}
      {rec.error ? <p className="error-text">{rec.error}</p> : null}
      {failed ? <p className="error-text">{zh.speak.failed}</p> : null}
      {feedback ? (
        <div className={`feedback feedback-${feedback.tone}`} role="status">
          <p className="feedback-praise">
            {zh.feedbackTone[feedback.tone]} {feedback.praise}
          </p>
          {feedback.tip ? <p className="feedback-tip">💡 {feedback.tip}</p> : null}
          {heard ? (
            <p className="muted small">
              {zh.speak.heard}“{heard}”
            </p>
          ) : null}
        </div>
      ) : null}
      {awaitingSelf ? (
        <div className="self-rate">
          <p className="muted small">{zh.speak.selfModeBody}</p>
          <Button variant="success" onClick={() => selfRate(true)}>
            {zh.speak.selfGood}
          </Button>
          <Button onClick={() => selfRate(false)}>{zh.speak.selfAgain}</Button>
        </div>
      ) : null}
    </div>
  );
}
