import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCaptureRequest } from './capture';
import { mediaFilePath, parseMediaUrl } from './media';
import { chooseUserDataDir, resolveAppPaths } from './paths';

describe('media URLs', () => {
  it('accepts content clips and recordings', () => {
    expect(parseMediaUrl('media://audio/bf_emma_0123456789abcdef.wav')).toEqual({
      kind: 'audio',
      file: 'bf_emma_0123456789abcdef.wav',
    });
    expect(parseMediaUrl('media://rec/u01_c01-1700000000000-abcd1234.wav')?.kind).toBe('rec');
  });

  it('URL dot-segments are resolved by the URL parser and stay inside the folder', () => {
    expect(parseMediaUrl('media://audio/../secret.wav')).toEqual({ kind: 'audio', file: 'secret.wav' });
  });

  it.each([
    'media://audio/%2e%2e%2fsecret.wav',
    'media://audio/a/b.wav',
    'media://audio/x.mp3',
    'media://other/x.wav',
    'file:///C:/x.wav',
    'media://audio/',
    'not a url',
    'media://audio/..%5Cx.wav',
  ])('rejects %s', (url) => {
    expect(parseMediaUrl(url)).toBeNull();
  });

  it('maps to the right folder', () => {
    const dirs = { audioDir: join('R', 'audio'), recordingsDir: join('U', 'recordings') };
    expect(mediaFilePath({ kind: 'audio', file: 'a.wav' }, dirs)).toBe(join('R', 'audio', 'a.wav'));
    expect(mediaFilePath({ kind: 'rec', file: 'b.wav' }, dirs)).toBe(join('U', 'recordings', 'b.wav'));
  });
});

describe('paths', () => {
  it('uses <repo>/resources in development and process.resourcesPath when installed', () => {
    const dev = resolveAppPaths({
      isPackaged: false,
      appPath: 'REPO',
      resourcesPath: 'ELECTRON',
      userDataDir: 'UD',
    });
    expect(dev.contentBundle).toBe(join('REPO', 'resources', 'content', 'bundle.json'));
    expect(dev.whisperModelDir).toBe(join('REPO', 'resources', 'models', 'whisper-base.en'));
    const prod = resolveAppPaths({
      isPackaged: true,
      appPath: 'ASAR',
      resourcesPath: 'RES',
      userDataDir: 'UD',
    });
    expect(prod.audioDir).toBe(join('RES', 'audio'));
    expect(prod.dbFile).toBe(join('UD', 'data', 'learning.sqlite'));
  });

  it('keeps development data apart from the installed app', () => {
    expect(chooseUserDataDir({ isPackaged: false, appDataDir: 'AD' })).toBe(join('AD', 'KaikouEnglish-dev'));
    expect(chooseUserDataDir({ isPackaged: true, appDataDir: 'AD' })).toBe(join('AD', 'KaikouEnglish'));
    expect(chooseUserDataDir({ isPackaged: true, appDataDir: 'AD', override: 'X' })).toBe('X');
  });
});

describe('capture flag', () => {
  it('is off unless asked for', () => {
    expect(parseCaptureRequest(['electron', '.'], {})).toBeNull();
  });
  it('reads the flag, delay and script', () => {
    const r = parseCaptureRequest(['electron', '--capture=out.png'], {
      KAIKOU_CAPTURE_DELAY: '100',
      KAIKOU_CAPTURE_SCRIPT: '1',
    });
    expect(r).toMatchObject({ delayMs: 100, script: '1' });
    expect(r?.file.endsWith('out.png')).toBe(true);
  });
});
