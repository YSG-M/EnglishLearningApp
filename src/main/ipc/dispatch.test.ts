import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_CHANNELS } from '../../shared/ipc';
import { silentLogger } from '../logger';
import { FakeAsrProvider, UnavailableAsrProvider } from '../speech/asrProvider';
import { createTestApp, type TestApp } from '../test-support/fixtures';
import { createDispatcher, resolveHandler } from './dispatch';

let dir: string;
let t: TestApp;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaikou-ipc-'));
  t = createTestApp({ recordingsDir: dir, asr: new FakeAsrProvider(['nice to meet you']) });
});
afterEach(() => {
  t.db.close();
  rmSync(dir, { recursive: true, force: true });
});

const speech = (n = 16000) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 3) * 0.3);

describe('IPC dispatch', () => {
  it('has an implementation for every channel in the contract', () => {
    for (const c of API_CHANNELS) expect(typeof resolveHandler(t.api, c)).toBe('function');
  });

  it('wraps results in an ok envelope', async () => {
    const dispatch = createDispatcher(t.api, silentLogger);
    const res = await dispatch('today.get', []);
    expect(res.ok).toBe(true);
  });

  it('rejects malformed input with INVALID_INPUT', async () => {
    const dispatch = createDispatcher(t.api, silentLogger);
    expect(await dispatch('parts.complete', [{ partId: 42 }])).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(await dispatch('today.addActiveTime', [-5])).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(await dispatch('settings.update', [{ unknownKey: 1 }])).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(await dispatch('nope.nothing', [])).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  it('passes AppError codes through and hides internal errors', async () => {
    const dispatch = createDispatcher(t.api, silentLogger);
    expect(await dispatch('parts.complete', [{ partId: 'zz', activeMs: 0 }])).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    const broken = createDispatcher(
      { ...t.api, today: { ...t.api.today, get: () => Promise.reject(new Error('SQLITE_CORRUPT details')) } },
      silentLogger,
    );
    const res = await broken('today.get', []);
    expect(res).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    expect(JSON.stringify(res)).not.toContain('SQLITE');
  });

  it('a settings patch changes only the given fields', async () => {
    const dispatch = createDispatcher(t.api, silentLogger);
    await dispatch('settings.update', [{ showHints: false }]);
    const res = await dispatch('settings.update', [{ reviewCap: 30 }]);
    expect(res).toMatchObject({ ok: true, value: { showHints: false, reviewCap: 30 } });
  });

  it('recognises speech, keeps the recording and stores the transcript', async () => {
    const dispatch = createDispatcher(t.api, silentLogger);
    const res = await dispatch('speech.recognize', [
      { samples: speech(), sampleRate: 16000, itemId: 'u01.c02', keep: true },
    ]);
    expect(res).toMatchObject({ ok: true, value: { text: 'nice to meet you', durationMs: 1000 } });
    const list = await t.api.recordings.list('u01.c02');
    expect(list[0]).toMatchObject({ transcript: 'nice to meet you' });
    const id = (res as { value: { recordingId: string } }).value.recordingId;
    expect(
      await dispatch('speech.annotateRecording', [{ recordingId: id, score: 1, transcript: 'x' }]),
    ).toMatchObject({ ok: true });
  });

  it('reports SPEECH_UNAVAILABLE when there is no model', async () => {
    t.db.close();
    t = createTestApp({ recordingsDir: dir, asr: new UnavailableAsrProvider() });
    const dispatch = createDispatcher(t.api, silentLogger);
    const res = await dispatch('speech.recognize', [
      { samples: speech(), sampleRate: 16000, itemId: 'x', keep: false },
    ]);
    expect(res).toMatchObject({ ok: false, error: { code: 'SPEECH_UNAVAILABLE' } });
  });

  it('rejects audio at the wrong sample rate or empty', async () => {
    const dispatch = createDispatcher(t.api, silentLogger);
    expect(
      await dispatch('speech.recognize', [
        { samples: speech(), sampleRate: 44100, itemId: 'x', keep: false },
      ]),
    ).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(
      await dispatch('speech.recognize', [
        { samples: new Float32Array(0), sampleRate: 16000, itemId: 'x', keep: false },
      ]),
    ).toMatchObject({
      ok: false,
    });
  });

  it('saves challenges only for known challenge ids', async () => {
    const dispatch = createDispatcher(t.api, silentLogger);
    expect(
      await dispatch('recordings.saveChallenge', [
        { challengeId: 'ch01', samples: speech(), sampleRate: 16000 },
      ]),
    ).toMatchObject({ ok: true });
    expect(
      await dispatch('recordings.saveChallenge', [
        { challengeId: 'ch99', samples: speech(), sampleRate: 16000 },
      ]),
    ).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('a missing content bundle becomes a NOT_FOUND error, not a crash', async () => {
    t.db.close();
    t = createTestApp({ recordingsDir: dir, bundle: null });
    const dispatch = createDispatcher(t.api, silentLogger);
    expect(await dispatch('content.getBundle', [])).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(await dispatch('app.getInfo', [])).toMatchObject({
      ok: true,
      value: { contentVersion: 'missing' },
    });
  });

  it('exports a diagnostics folder', async () => {
    const res = await t.api.diagnostics.exportBundle();
    expect(res.folder).toContain('KaikouEnglish-diagnostics-');
  });
});
