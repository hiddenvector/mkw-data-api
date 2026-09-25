import { describe, it, expect, vi } from 'vitest';
import app, { createApp } from './index';

const BASE = '/mkw/api/v1';
const ETAG_PATTERN = /^"\d+\.\d+\.\d+-[0-9a-z]+"$/;

// Helper to make requests
async function request(path: string, options?: RequestInit) {
  return app.request(`${BASE}${path}`, options);
}

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord => value as JsonRecord;

describe('Health endpoint', () => {
  it('returns health status with all required fields', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    expect(body.status).toBe('ok');
    expect(body.apiVersion).toBe('v1');
    expect(body.serviceVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Date.parse(body.timestamp as string)).not.toBeNaN();
    expect(body.dataVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.dataLoaded as JsonRecord).toMatchObject({
      characters: expect.any(Number),
      vehicles: expect.any(Number),
      tracks: expect.any(Number),
    });
  });

  it('has no-cache headers', async () => {
    const res = await request('/health');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('Characters endpoints', () => {
  it('GET /characters returns all characters with dataVersion', async () => {
    const res = await request('/characters');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toMatch(ETAG_PATTERN);

    const body = asRecord(await res.json());
    expect(body.dataVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(body.characters)).toBe(true);
    expect((body.characters as unknown[]).length).toBeGreaterThan(0);
  });

  it('GET /characters returns 304 when ETag matches', async () => {
    // First request to get the ETag
    const firstRes = await request('/characters');
    const etag = firstRes.headers.get('ETag');
    expect(etag).toMatch(ETAG_PATTERN);

    // Second request with If-None-Match
    const res = await request('/characters', {
      headers: { 'If-None-Match': etag! },
    });
    expect(res.status).toBe(304);
  });

  it('GET /characters/:id returns a character', async () => {
    const res = await request('/characters/dry-bones');
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    expect(body.id).toBe('dry-bones');
    expect(body.name).toBe('Dry Bones');
    expect(body.speed).toBeDefined();
    expect(body.handling).toBeDefined();
  });

  it('GET /characters/:id returns 404 for unknown character', async () => {
    const res = await request('/characters/not-a-character');
    expect(res.status).toBe(404);

    const body = asRecord(await res.json());
    const error = asRecord(body.error);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('not-a-character');
  });

  it('GET /characters/:id returns 400 for invalid ID format', async () => {
    const res = await request('/characters/INVALID');
    expect(res.status).toBe(400);

    const body = asRecord(await res.json());
    const error = asRecord(body.error);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Vehicles endpoints', () => {
  it('GET /vehicles returns all vehicles with dataVersion', async () => {
    const res = await request('/vehicles');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toMatch(ETAG_PATTERN);

    const body = asRecord(await res.json());
    expect(body.dataVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(body.vehicles)).toBe(true);
  });

  it('GET /vehicles returns 304 when ETag matches', async () => {
    const firstRes = await request('/vehicles');
    const etag = firstRes.headers.get('ETag');

    const res = await request('/vehicles', {
      headers: { 'If-None-Match': etag! },
    });
    expect(res.status).toBe(304);
  });

  it('GET /vehicles/:id returns a vehicle', async () => {
    const res = await request('/vehicles/standard-bike');
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    expect(body.id).toBe('standard-bike');
    expect(body.tag).toBeDefined();
  });

  it('GET /vehicles/:id returns 404 for unknown vehicle', async () => {
    const res = await request('/vehicles/not-a-vehicle');
    expect(res.status).toBe(404);

    const body = asRecord(await res.json());
    const error = asRecord(body.error);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('GET /vehicles?tag filter only returns matching vehicles', async () => {
    const res = await request('/vehicles?tag=st-a-2');
    const vehicles = asRecord(await res.json()).vehicles as JsonRecord[];
    expect(vehicles.length).toBeGreaterThan(0);
    expect(vehicles.every((v) => v.tag === 'st-a-2')).toBe(true);
  });

  it('GET /vehicles?tag returns vehicles by tag', async () => {
    // First get a vehicle to find a valid tag
    const vehiclesRes = await request('/vehicles');
    const vehiclesBody = asRecord(await vehiclesRes.json());
    const vehicles = vehiclesBody.vehicles as JsonRecord[];
    const validTag = vehicles[0].tag as string;

    const res = await request(`/vehicles?tag=${validTag}`);
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    expect(Array.isArray(body.vehicles)).toBe(true);
    expect((body.vehicles as unknown[]).length).toBeGreaterThan(0);
  });

  it('GET /vehicles?tag returns empty list for unknown tag', async () => {
    const res = await request('/vehicles?tag=not-a-tag');
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    expect(Array.isArray(body.vehicles)).toBe(true);
    expect((body.vehicles as unknown[]).length).toBe(0);
  });

  it('GET /vehicles?tag returns 400 for invalid tag format', async () => {
    const res = await request('/vehicles?tag=INVALID');
    expect(res.status).toBe(400);

    const body = asRecord(await res.json());
    const error = asRecord(body.error);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Tracks endpoints', () => {
  it('GET /tracks returns all tracks with dataVersion', async () => {
    const res = await request('/tracks');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toMatch(ETAG_PATTERN);

    const body = asRecord(await res.json());
    expect(body.dataVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(body.tracks)).toBe(true);
  });

  it('GET /tracks returns 304 when ETag matches', async () => {
    const firstRes = await request('/tracks');
    const etag = firstRes.headers.get('ETag');

    const res = await request('/tracks', {
      headers: { 'If-None-Match': etag! },
    });
    expect(res.status).toBe(304);
  });

  it('GET /tracks/:id returns a track', async () => {
    // First get tracks to find a valid ID
    const tracksRes = await request('/tracks');
    const tracksBody = asRecord(await tracksRes.json());
    const tracks = tracksBody.tracks as JsonRecord[];
    const validId = tracks[0].id as string;

    const res = await request(`/tracks/${validId}`);
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    expect(body.id).toBe(validId);
    expect(body.surfaceCoverage).toBeDefined();
  });

  it('GET /tracks/:id returns 404 for unknown track', async () => {
    const res = await request('/tracks/not-a-track');
    expect(res.status).toBe(404);

    const body = asRecord(await res.json());
    const error = asRecord(body.error);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('GET /tracks?cup returns tracks by cupId', async () => {
    const res = await request('/tracks?cup=mushroom-cup');
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    const tracks = body.tracks as JsonRecord[];
    expect(tracks).toHaveLength(4);
    for (const track of tracks) {
      expect(track.cupId).toBe('mushroom-cup');
      expect(track.cup).toBe('Mushroom Cup');
    }
  });

  it('GET /tracks?cup returns empty list for unknown cup', async () => {
    const res = await request('/tracks?cup=not-a-cup');
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    expect(Array.isArray(body.tracks)).toBe(true);
    expect((body.tracks as unknown[]).length).toBe(0);
  });

  it('GET /tracks?cup returns 400 for invalid cup format', async () => {
    const res = await request('/tracks?cup=INVALID');
    expect(res.status).toBe(400);

    const body = asRecord(await res.json());
    const error = asRecord(body.error);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Rallies endpoints', () => {
  it('GET /rallies returns released rallies with coverage', async () => {
    const res = await request('/rallies');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toMatch(ETAG_PATTERN);

    const body = asRecord(await res.json());
    const rallies = body.rallies as JsonRecord[];
    expect(rallies.length).toBeGreaterThan(0);
    expect(rallies.map((r) => r.name)).not.toContain('Not released yet');
    for (const rally of rallies) {
      const coverage = asRecord(rally.surfaceCoverage);
      expect(coverage).not.toHaveProperty('offRoad');
      const terrain = asRecord(rally.terrainCoverage);
      const hundredths = ['road', 'rough', 'water'].map((k) =>
        Math.round((terrain[k] as number) * 100),
      );
      expect(hundredths.reduce((a, b) => a + b)).toBe(10_000);
    }
  });

  it('GET /rallies/:id returns a rally and supports ETags', async () => {
    const res = await request('/rallies/golden-rally');
    expect(res.status).toBe(200);
    expect(asRecord(await res.json()).name).toBe('Golden Rally');

    const etag = res.headers.get('ETag')!;
    const revalidated = await request('/rallies/golden-rally', {
      headers: { 'If-None-Match': etag },
    });
    expect(revalidated.status).toBe(304);
  });

  it('GET /rallies/:id returns 404 and 400 as appropriate', async () => {
    expect((await request('/rallies/not-a-rally')).status).toBe(404);
    expect((await request('/rallies/BAD')).status).toBe(400);
  });
});

describe('Mechanics endpoint', () => {
  it('GET /mechanics returns level-indexed tables', async () => {
    const res = await request('/mechanics');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toMatch(ETAG_PATTERN);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, must-revalidate');

    const body = asRecord(await res.json());
    const speed = asRecord(body.speed);
    const road = speed.road as JsonRecord[];
    expect(road[0]).toEqual({ level: 0, units: 100, bonusPercent: 0 });
    road.forEach((entry, i) => expect(entry.level).toBe(i));

    const coinCurve = body.coinCurve as JsonRecord[];
    for (const entry of coinCurve) {
      const byCoins = entry.bonusPercentByCoins as number[];
      expect(byCoins).toHaveLength(21);
      expect(byCoins[0]).toBe(0);
      expect(byCoins[20]).toBe(5);
    }
  });

  it('GET /mechanics revalidates to 304', async () => {
    const etag = (await request('/mechanics')).headers.get('ETag')!;
    expect((await request('/mechanics', { headers: { 'If-None-Match': etag } })).status).toBe(304);
  });
});

describe('Response headers', () => {
  it('includes X-Request-ID header', async () => {
    const res = await request('/health');
    expect(res.headers.get('X-Request-ID')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('includes X-Response-Time header', async () => {
    const res = await request('/health');
    expect(res.headers.get('X-Response-Time')).toMatch(/^\d+\.\d+ms$/);
  });

  it('includes API-Version header', async () => {
    const res = await request('/health');
    expect(res.headers.get('API-Version')).toBe('v1');
  });

  it('includes security headers', async () => {
    const res = await request('/health');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  it('includes cache-control with must-revalidate for data endpoints', async () => {
    const res = await request('/characters');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, must-revalidate');
  });

  it('uses docs CSP and cache-control for /docs', async () => {
    const res = await request('/docs');
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain('https://cdn.jsdelivr.net/npm/@scalar/api-reference@');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
    // The page must load exactly the bundle the CSP allows
    const html = await res.text();
    const src = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
    expect(src).toBeDefined();
    expect(csp).toContain(src);
  });

  it('never caches error responses', async () => {
    for (const path of ['/characters/not-a-character', '/characters/INVALID', '/nope']) {
      const res = await request(path);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('includes cache-control on 304 responses', async () => {
    const etag = (await request('/characters')).headers.get('ETag')!;
    const res = await request('/characters', { headers: { 'If-None-Match': etag } });
    expect(res.status).toBe(304);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, must-revalidate');
    expect(res.headers.get('ETag')).toBe(etag);
  });

  it('preserves a well-formed upstream X-Request-ID', async () => {
    const res = await request('/health', { headers: { 'X-Request-ID': 'upstream-123.abc' } });
    expect(res.headers.get('X-Request-ID')).toBe('upstream-123.abc');
  });

  it('replaces oversized or malformed upstream X-Request-IDs', async () => {
    for (const bad of ['x'.repeat(129), 'has spaces', '<script>']) {
      const res = await request('/characters/nope', { headers: { 'X-Request-ID': bad } });
      const id = res.headers.get('X-Request-ID');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      const body = asRecord(await res.json());
      expect(asRecord(body.error).requestId).toBe(id);
    }
  });
});

describe('304 Not Modified handling', () => {
  it.each(['/characters/dry-bones', '/vehicles/standard-bike', '/tracks/crown-city'])(
    'supports ETags on item endpoint %s',
    async (path) => {
      const first = await request(path);
      const etag = first.headers.get('ETag');
      expect(etag).toMatch(ETAG_PATTERN);
      const res = await request(path, { headers: { 'If-None-Match': etag! } });
      expect(res.status).toBe(304);
    },
  );

  it('does not return 304 for a missing item even with a wildcard', async () => {
    const res = await request('/tracks/not-a-track', { headers: { 'If-None-Match': '*' } });
    expect(res.status).toBe(404);
  });

  it('uses distinct ETags per collection', async () => {
    const etags = await Promise.all(
      ['/characters', '/vehicles', '/tracks'].map(async (p) =>
        (await request(p)).headers.get('ETag'),
      ),
    );
    expect(new Set(etags).size).toBe(3);
  });

  it('supports wildcard If-None-Match', async () => {
    const res = await request('/characters', {
      headers: { 'If-None-Match': '*' },
    });
    expect(res.status).toBe(304);
  });

  it('supports weak ETag prefix', async () => {
    const firstRes = await request('/characters');
    const etag = firstRes.headers.get('ETag');

    const res = await request('/characters', {
      headers: { 'If-None-Match': `W/${etag}` },
    });
    expect(res.status).toBe(304);
  });

  it('supports multiple ETags in header', async () => {
    const firstRes = await request('/characters');
    const etag = firstRes.headers.get('ETag');

    const res = await request('/characters', {
      headers: { 'If-None-Match': `"other-etag", ${etag}, "another-etag"` },
    });
    expect(res.status).toBe(304);
  });

  it('returns 200 when ETag does not match', async () => {
    const res = await request('/characters', {
      headers: { 'If-None-Match': '"non-matching-etag"' },
    });
    expect(res.status).toBe(200);
  });
});

describe('OpenAPI spec', () => {
  it('GET /openapi.json returns valid OpenAPI spec', async () => {
    const res = await request('/openapi.json');
    expect(res.status).toBe(200);

    const body = asRecord(await res.json());
    expect(body.openapi).toBe('3.1.0');
    const info = asRecord(body.info);
    expect(info.title).toBeDefined();
    expect(body.paths).toBeDefined();
    const components = asRecord(body.components);
    expect(asRecord(components.schemas).Track).toBeDefined();
    const paths = asRecord(body.paths);
    const listTracks = asRecord(asRecord(paths[`${BASE}/tracks`]).get);
    const params = listTracks.parameters as JsonRecord[];
    expect(params.map((p) => p.name)).toEqual(expect.arrayContaining(['cup', 'if-none-match']));
    const ok = asRecord(asRecord(listTracks.responses)['200']);
    expect(asRecord(ok.headers).ETag).toBeDefined();
  });

  it('documents the edge 429 response on every route', async () => {
    const spec = asRecord(await (await request('/openapi.json')).json());
    const paths = asRecord(spec.paths);
    const routes = Object.values(paths).map((item) => asRecord(asRecord(item).get));
    expect(routes).toHaveLength(10);
    for (const route of routes) {
      const limited = asRecord(asRecord(route.responses)['429']);
      expect(Object.keys(asRecord(limited.content))).toEqual(['text/plain']);
      expect(asRecord(limited.headers)['Retry-After']).toBeDefined();
    }
  });

  it('GET /openapi.json returns 304 when ETag matches', async () => {
    const firstRes = await request('/openapi.json');
    const etag = firstRes.headers.get('ETag');
    expect(etag).toMatch(ETAG_PATTERN);

    const res = await request('/openapi.json', {
      headers: { 'If-None-Match': etag! },
    });
    expect(res.status).toBe(304);
  });

  it('GET /openapi.json has cache headers', async () => {
    const res = await request('/openapi.json');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });
});

describe('404 handler', () => {
  it('returns structured error for unknown endpoints', async () => {
    const res = await request('/not-an-endpoint');
    expect(res.status).toBe(404);

    const body = asRecord(await res.json());
    const error = asRecord(body.error);
    expect(error.code).toBe('NOT_FOUND');
    expect(body.availableEndpoints).toEqual([
      `GET ${BASE}/health`,
      `GET ${BASE}/characters`,
      `GET ${BASE}/characters/{id}`,
      `GET ${BASE}/vehicles`,
      `GET ${BASE}/vehicles/{id}`,
      `GET ${BASE}/tracks`,
      `GET ${BASE}/tracks/{id}`,
      `GET ${BASE}/rallies`,
      `GET ${BASE}/rallies/{id}`,
      `GET ${BASE}/mechanics`,
      `GET ${BASE}/openapi.json`,
      `GET ${BASE}/docs`,
    ]);
  });
});

describe('Global error handler', () => {
  it('returns structured 500 response', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const testApp = createApp();
    testApp.get('/boom', () => {
      throw new Error('boom');
    });
    const res = await testApp.request(`${BASE}/boom`);
    expect(res.status).toBe(500);
    const body = asRecord(await res.json());
    const error = asRecord(body.error);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('An unexpected error occurred');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    spy.mockRestore();
  });
});
