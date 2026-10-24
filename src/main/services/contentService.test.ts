import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { silentLogger } from '../logger';
import { miniBundle } from '../test-support/fixtures';
import { ContentService } from './contentService';

describe('ContentService', () => {
  it('loads and caches the bundle', () => {
    let reads = 0;
    const svc = new ContentService('b.json', silentLogger, () => {
      reads++;
      return JSON.stringify(miniBundle());
    });
    expect(svc.bundle().contentVersion).toBe('0.0.1');
    svc.bundle();
    expect(reads).toBe(1);
  });

  it.each([
    [
      'missing file',
      () => {
        throw new Error('ENOENT');
      },
    ],
    ['broken JSON', () => '{ nope'],
    ['wrong shape', () => JSON.stringify({ hello: 1 })],
  ])('turns a %s into a user-facing NOT_FOUND error', (_name, read) => {
    const svc = new ContentService('b.json', silentLogger, read);
    expect(svc.load().ok).toBe(false);
    expect(() => svc.bundle()).toThrow(AppError);
    expect(svc.version()).toBe('missing');
  });
});
