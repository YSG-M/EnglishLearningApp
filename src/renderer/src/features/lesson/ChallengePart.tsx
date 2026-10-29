/**
 * 录音挑战: a longer free recording, saved so she can hear her progress against earlier ones.
 * No scoring: the point is to talk, and to notice later how much more she can say.
 */
import { useEffect, useRef, useState } from 'react';
import type { Recording } from '../../audio/recorder';
import type { ChallengeItem } from '@shared/content/bundle';
import type { RecordingView } from '@shared/ipc';
import { api, logError } from '../../api/client';
import { player } from '../../audio/player';
import { wavBlobUrl } from '../../audio/wav';
import { PlayRow } from '../../components/AudioButtons';
import { ChineseText } from '../../components/ChineseText';
import { Button, Card, Notice } from '../../components/ui';
import { useRecorder } from '../../hooks/useRecorder';
import { zh } from '../../i18n/zh';
import { useApp } from '../../state/AppContext';

export function ChallengeRecordings({ recordings, title }: { recordings: RecordingView[]; title: string }) {
  const { bundle } = useApp();
  if (!recordings.length) return null;
  return (
    <div className="recording-list">
      <h3>{title}</h3>
      <ul>
        {recordings.map((r) => (
          <li key={r.id}>
            <span>
              {bundle.challenges[r.itemId]?.title ?? r.itemId} ·{' '}
              {new Date(r.createdAt).toLocaleDateString('zh-CN')} · {Math.round(r.durationMs / 1000)}s
            </span>
            <Button size="sm" onClick={() => void player.play({ url: r.url, id: r.id })}>
              ▶ {zh.common.play}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChallengePart({
  challenge,
  onFinish,
  onActivity,
}: {
  challenge: ChallengeItem;
  onFinish(): void;
  onActivity?(): void;
}) {
  const { settings } = useApp();
  const rec = useRecorder();
  const [earlier, setEarlier] = useState<RecordingView[]>([]);
  const [saved, setSaved] = useState<RecordingView | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [pending, setPending] = useState<Recording | null>(null);
  const [saving, setSaving] = useState(false);
  const [listened, setListened] = useState(false);
  const mounted = useRef(true);
  const [elapsed, setElapsed] = useState(0);
  const recording = rec.state === 'recording';

  useEffect(() => {
    api.recordings
      .listChallenges()
      .then((list) => setEarlier(list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))))
      .catch((err: unknown) => logError('listChallenges', err));
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
      onActivity?.();
    }, 500);
    return () => clearInterval(t);
  }, [recording, onActivity]);

  useEffect(() => () => void (localUrl && URL.revokeObjectURL(localUrl)), [localUrl]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = async () => {
    setSaveFailed(false);
    setElapsed(0);
    setSaved(null);
    setPending(null);
    setListened(false);
    const r = await rec.record({
      silenceMs: settings.silenceMs,
      autoStop: false,
      maxMs: challenge.maxSeconds * 1000,
    });
    if (!r || !mounted.current) return;
    setLocalUrl(wavBlobUrl(r.samples, r.sampleRate));
    setPending(r);
  };

  const save = async () => {
    if (!pending || saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      setSaved(
        await api.recordings.saveChallenge({
          challengeId: challenge.id,
          samples: pending.samples,
          sampleRate: 16000,
        }),
      );
    } catch (err) {
      logError('saveChallenge', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="challenge">
      <Card title={`🎙️ ${challenge.title}`}>
        <p className="lead">{challenge.intro}</p>
        <p className="muted">{zh.part.challengeIntro}</p>
        <ul className="example-list">
          {challenge.prompts.map((p) => (
            <li key={p.audio}>
              <p className="en">{p.en}</p>
              <ChineseText text={p.zh} className="small" />
              <PlayRow sentence={p} size="sm" />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        {recording ? (
          <>
            <div className="level-meter">
              <div className="level-fill" style={{ width: `${Math.round(rec.level * 100)}%` }} />
              <span className="level-label">
                {zh.part.secondsLeft(Math.max(0, challenge.maxSeconds - elapsed))}
              </span>
            </div>
            <Button variant="warn" size="lg" onClick={rec.stop}>
              ⏹ {zh.part.challengeStop}
            </Button>
          </>
        ) : (
          <Button variant="primary" size="lg" disabled={saving} onClick={() => void start()}>
            🎤 {localUrl ? zh.common.retry : zh.part.challengeRecord}
          </Button>
        )}
        {rec.error ? <p className="error-text">{rec.error}</p> : null}
        {saveFailed ? <Notice tone="warn">{zh.part.challengeSaveFailed}</Notice> : null}
        {localUrl && !recording ? (
          <div className="row">
            {saved ? <p className="success-text">✅ {zh.part.challengeSaved}</p> : null}
            <Button
              onClick={() => {
                void player.play({ url: localUrl, id: 'challenge-own' });
                setListened(true);
              }}
            >
              👂 {zh.part.challengeThisTime}
            </Button>
            {pending && !saved ? (
              <Button disabled={saving || !listened} onClick={() => void save()}>
                {saving ? '正在保存…' : '保存这次录音'}
              </Button>
            ) : null}
          </div>
        ) : null}
        {earlier.length ? (
          <ChallengeRecordings recordings={earlier} title={zh.part.challengeEarlier} />
        ) : (
          <p className="muted">{zh.part.challengeNone}</p>
        )}
      </Card>

      <div className="step-nav">
        <span />
        <Button variant="primary" size="lg" onClick={onFinish} disabled={recording || !saved || saveFailed}>
          ✓ {zh.common.done}
        </Button>
      </div>
    </div>
  );
}
