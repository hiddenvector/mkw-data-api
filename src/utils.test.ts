import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { hash53, isNotModified, makeEtag } from './utils';

const app = new Hono();
app.get('/', (c) => (isNotModified(c, '"v1-abc"') ? c.body(null, 304) : c.text('ok')));
const get = (ifNoneMatch?: string) =>
  app.request('/', { headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {} });

describe('hash53', () => {
  it('is deterministic and sensitive to input', () => {
    expect(hash53('abc')).toBe(hash53('abc'));
    expect(hash53('abc')).not.toBe(hash53('abd'));
    expect(hash53('abc', 1)).not.toBe(hash53('abc'));
  });
});

describe('makeEtag', () => {
  it('is a quoted strong validator that changes with body and prefix', () => {
    const etag = makeEtag('1.0.0', { a: 1 });
    expect(etag).toMatch(/^"1\.0\.0-[0-9a-z]+"$/);
    expect(makeEtag('1.0.0', { a: 2 })).not.toBe(etag);
    expect(makeEtag('1.0.1', { a: 1 })).not.toBe(etag);
  });
});

describe('isNotModified', () => {
  it('always sets the ETag header', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBe('"v1-abc"');
  });

  it.each([
    ['exact match', '"v1-abc"'],
    ['wildcard', '*'],
    ['weak client tag', 'W/"v1-abc"'],
    ['list with match', '"x", "v1-abc" , "y"'],
  ])('returns 304 for %s', async (_, header) => {
    expect((await get(header)).status).toBe(304);
  });

  it('returns 200 when nothing matches', async () => {
    expect((await get('"other", W/"v1-abd"')).status).toBe(200);
  });
});
