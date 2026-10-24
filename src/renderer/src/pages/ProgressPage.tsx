import { useEffect, useMemo, useState } from 'react';
import type { ChunkItem } from '@shared/content/bundle';
import type { ProgressStats, RecordingView } from '@shared/ipc';
import { api, logError } from '../api/client';
import { player } from '../audio/player';
import { PlayButton } from '../components/AudioButtons';
import { Button, Card, Loading, Notice, PageHeader } from '../components/ui';
import { ChallengeRecordings } from '../features/lesson/ChallengePart';
import { zh } from '../i18n/zh';
import { useApp } from '../state/AppContext';
import { cardLabel } from '../state/content';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function ActivityBars({ activity }: { activity: ProgressStats['activity'] }) {
  const max = Math.max(30 * 60_000, ...activity.map((a) => a.activeMs));
  return (
    <div className="activity-bars" role="img" aria-label={zh.progress.activity}>
      {activity.map((a) => (
        <div
          key={a.day}
          className={`activity-bar ${a.counted ? 'counted' : ''}`}
          title={`${a.day} · ${zh.progress.minutes(Math.round(a.activeMs / 60_000))}`}
        >
          <div className="activity-fill" style={{ height: `${Math.round((a.activeMs / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function ChunkComparison({ chunk }: { chunk: ChunkItem }) {
  const [recs, setRecs] = useState<RecordingView[] | null>(null);
  useEffect(() => {
    api.recordings
      .list(chunk.id)
      .then((list) => setRecs(list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))))
      .catch((err: unknown) => logError('recordings.list', err));
  }, [chunk.id]);
  if (!recs?.length) return null;
  const first = recs[0]!;
  const latest = recs[recs.length - 1]!;
  return (
    <li className="compare-row">
      <span className="en">{chunk.en}</span>
      <div className="row">
        <PlayButton clip={chunk.audio} text={chunk.en} size="sm" />
        <Button size="sm" onClick={() => void player.play({ url: first.url, id: first.id })}>
          ▶ {zh.progress.first}
        </Button>
        {latest.id !== first.id ? (
          <Button size="sm" onClick={() => void player.play({ url: latest.url, id: latest.id })}>
            ▶ {zh.progress.latest}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function ProgressPage() {
  const { bundle } = useApp();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [challenges, setChallenges] = useState<RecordingView[]>([]);
  const [failed, setFailed] = useState(false);
  const units = useMemo(
    () => Object.values(bundle.units).sort((a, b) => a.id.localeCompare(b.id)),
    [bundle.units],
  );
  const [unitId, setUnitId] = useState(units[0]?.id ?? '');

  useEffect(() => {
    api.progress
      .getStats()
      .then(setStats)
      .catch((err: unknown) => {
        logError('progress.getStats', err);
        setFailed(true);
      });
    api.recordings
      .listChallenges()
      .then((l) => setChallenges(l.sort((a, b) => a.createdAt.localeCompare(b.createdAt))))
      .catch((err: unknown) => logError('listChallenges', err));
  }, []);

  if (failed) return <Notice tone="warn">{zh.errors.generic}</Notice>;
  if (!stats) return <Loading label={zh.common.loading} />;
  const unit = bundle.units[unitId];

  return (
    <div className="page">
      <PageHeader title={`📈 ${zh.progress.title}`} />
      <Card>
        <div className="stat-grid">
          <Stat label={zh.progress.totalDays} value={stats.streak.totalDays} />
          <Stat label={zh.progress.streak} value={stats.streak.current} />
          <Stat label={zh.progress.best} value={stats.streak.best} />
          <Stat label={zh.progress.restCards} value={stats.streak.restCards} />
          <Stat label={zh.progress.parts} value={`${stats.partsCompleted} / ${stats.partsTotal}`} />
          <Stat label={zh.progress.cards} value={stats.cardsLearned} />
          <Stat label={zh.progress.mature} value={stats.cardsMature} />
          <Stat label={zh.progress.reviews} value={stats.reviewsTotal} />
          <Stat
            label={zh.progress.accuracy}
            value={stats.accuracy7d === null ? '—' : `${Math.round(stats.accuracy7d * 100)}%`}
          />
        </div>
      </Card>

      <Card title={zh.progress.activity}>
        <ActivityBars activity={stats.activity} />
      </Card>

      <Card title={`🎙️ ${zh.progress.challenges}`}>
        {challenges.length ? (
          <ChallengeRecordings recordings={challenges} title="" />
        ) : (
          <p className="muted">{zh.progress.noChallenges}</p>
        )}
      </Card>

      <Card title={`🔁 ${zh.progress.recordings}`}>
        <p className="muted">{zh.progress.recordingsHelp}</p>
        <select className="select" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {zh.course.week(u.week)} · {u.title}
            </option>
          ))}
        </select>
        {unit ? (
          <ul className="compare-list" key={unit.id}>
            {unit.chunks.map((c) => (
              <ChunkComparison key={c.id} chunk={c} />
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title={`🧠 ${zh.progress.trouble}`}>
        {stats.troubleItems.length ? (
          <ul className="trouble-list">
            {stats.troubleItems.map((t) => {
              const label = cardLabel(bundle, t.cardId);
              if (!label) return null;
              return (
                <li key={t.cardId}>
                  <span className="en">{label.en}</span> <span className="muted">{label.zh}</span>{' '}
                  <span className="badge">{zh.progress.lapses(t.lapses)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">{zh.progress.troubleNone}</p>
        )}
      </Card>
    </div>
  );
}
