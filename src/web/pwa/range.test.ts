import { describe, expect, it } from 'vitest';
import { rangeResponse } from './range';
import { shouldUseCache } from './routing';

it('lets update staging fetch fresh same-path shell bytes instead of serving the old cache', () => {
  const base = new URL('https://example.test/EnglishLearningApp/');
  const shell = new URL('index.html', base);
  expect(shouldUseCache(new Request(shell), base)).toBe(true);
  expect(shouldUseCache(new Request(shell, { cache: 'no-store' }), base)).toBe(false);
  expect(shouldUseCache(new Request('https://example.test/other/index.html'), base)).toBe(false);
});

describe('complete audio byte ranges', () => {
  it.each([
    ['bytes=1-3', 'bcd', 'bytes 1-3/6'],
    ['bytes=4-', 'ef', 'bytes 4-5/6'],
    ['bytes=-2', 'ef', 'bytes 4-5/6'],
    ['bytes=0-99', 'abcdef', 'bytes 0-5/6'],
  ])('serves %s', async (range, body, contentRange) => {
    const res = await rangeResponse(
      new Response('abcdef', { headers: { 'Content-Type': 'audio/mp4' } }),
      range!,
    );
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe(contentRange);
    expect(res.headers.get('Content-Type')).toBe('audio/mp4');
    expect(await res.text()).toBe(body);
  });
  it.each(['bytes=6-', 'bytes=3-1', 'bytes=-0', 'bytes=0-1,3-4', 'bytes=-', 'invalid'])(
    'rejects %s with 416',
    async (range) => {
      const res = await rangeResponse(new Response('abcdef'), range);
      expect(res.status).toBe(416);
      expect(res.headers.get('Content-Range')).toBe('bytes */6');
    },
  );
  it('preserves a full response without a range', async () => {
    const res = await rangeResponse(new Response('abcdef'), null);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('abcdef');
  });
});
