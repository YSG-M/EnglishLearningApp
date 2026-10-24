import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MEDIA_FILE } from '../app/media';
import { FakeClock } from '../clock';
import { openDatabase, type Database } from '../db/database';
import { createRepositories } from '../db/repositories';
import { silentLogger } from '../logger';
import { KEEP_LATEST, RecordingService, safeFileStem } from './recordingService';
import { decodeWav, encodeWav } from './wav';

let dir: string;
let db: Database;
let clock: FakeClock;
let svc: RecordingService;

const tone = (n = 1600) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 5) * 0.5);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaikou-rec-'));
  db = openDatabase(':memory:');
  clock = new FakeClock('2026-11-02T09:00:00');
  svc = new RecordingService(join(dir, 'recordings'), createRepositories(db).recordings, clock, silentLogger);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('RecordingService', () => {
  it('writes a valid WAV with a media-safe name', () => {
    const r = svc.save('u01.c01', 'speech', tone(16000), 16000);
    expect(r.file).toMatch(MEDIA_FILE);
    expect(r.durationMs).toBe(1000);
    const wav = decodeWav(readFileSync(join(dir, 'recordings', r.file)));
    expect(wav.sampleRate).toBe(16000);
    expect(wav.samples.length).toBe(16000);
    expect(svc.list('u01.c01')[0]?.url).toBe(`media://rec/${r.file}`);
  });

  it('keeps the first attempt and the latest three', () => {
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      ids.push(svc.save('u01.c01', 'speech', tone(), 16000).id);
      clock.advanceMs(1000);
    }
    const kept = svc.list('u01.c01').map((r) => r.id);
    expect(kept).toEqual([ids[0], ...ids.slice(-KEEP_LATEST)]);
    expect(readdirSync(join(dir, 'recordings'))).toHaveLength(1 + KEEP_LATEST);
  });

  it('never prunes challenge recordings', () => {
    for (let i = 0; i < 6; i++) {
      svc.save('ch01', 'challenge', tone(), 16000);
      clock.advanceMs(1000);
    }
    expect(svc.listChallenges()).toHaveLength(6);
  });

  it('stores scores and transcripts', () => {
    const r = svc.save('u01.c02', 'speech', tone(), 16000);
    expect(svc.annotate(r.id, 0.9, 'nice to meet you')).toBe(true);
    expect(svc.list('u01.c02')[0]).toMatchObject({ score: 0.9, transcript: 'nice to meet you' });
    expect(svc.annotate('missing', 1, '')).toBe(false);
  });

  it('turns any item id into a safe file stem', () => {
    expect(safeFileStem('u01.c01')).toBe('u01_c01');
    expect(safeFileStem('../../etc/passwd')).toBe('etc_passwd');
    expect(safeFileStem('')).toBe('item');
    expect(existsSync(join(dir, 'recordings'))).toBe(false);
  });
});

describe('wav', () => {
  it('round-trips samples within 16-bit precision and clips out-of-range values', () => {
    const input = Float32Array.from([0, 0.5, -0.5, 1.5, -1.5]);
    const out = decodeWav(encodeWav(input, 16000)).samples;
    expect(Array.from(out).map((x) => Math.round(x * 100) / 100)).toEqual([0, 0.5, -0.5, 1, -1]);
  });

  it('rejects non-WAV data', () => {
    expect(() => decodeWav(Buffer.from('hello world, not a wav file at all'))).toThrow();
  });
});
