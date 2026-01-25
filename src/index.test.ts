import { describe, it, expect } from 'vitest';
import app from './index';

const BASE = '/mkw/api/v1';

// Helper to make requests
async function request(path: string, options?: RequestInit) {
  return app.request(`${BASE}${path}`, options);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJson = any;

describe('Health endpoint', () => {
  it('returns health status with all required fields', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as AnyJson;
    expect(body.status).toBe('ok');
    expect(body.apiVersion).toBe('v1');
    expect(body.serviceVersion).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.dataVersion).toBeDefined();
    expect(body.dataLoaded).toMatchObject({
      characters: expect.any(Number),
      vehicles: expect.any(Number),
      tracks: expect.any(Number),
    });
  });

  it('has no-cache headers', async () => {
    const res = await request('/health');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
  });
});

describe('Characters endpoints', () => {
  it('GET /characters returns all characters with dataVersion', async () => {
    const res = await request('/characters');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeDefined();

    const body = (await res.json()) as AnyJson;
    expect(body.dataVersion).toBeDefined();
    expect(Array.isArray(body.characters)).toBe(true);
    expect(body.characters.length).toBeGreaterThan(0);
  });

  it('GET /characters returns 304 when ETag matches', async () => {
    // First request to get the ETag
    const firstRes = await request('/characters');
    const etag = firstRes.headers.get('ETag');
    expect(etag).toBeDefined();

    // Second request with If-None-Match
    const res = await request('/characters', {
      headers: { 'If-None-Match': etag! },
    });
    expect(res.status).toBe(304);
  });

  it('GET /characters/:id returns a character', async () => {
    const res = await request('/characters/dry-bones');
    expect(res.status).toBe(200);

    const body = (await res.json()) as AnyJson;
    expect(body.id).toBe('dry-bones');
    expect(body.name).toBe('Dry Bones');
    expect(body.speed).toBeDefined();
    expect(body.handling).toBeDefined();
  });

  it('GET /characters/:id returns 404 for unknown character', async () => {
    const res = await request('/characters/not-a-character');
    expect(res.status).toBe(404);

    const body = (await res.json()) as AnyJson;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('not-a-character');
  });

  it('GET /characters/:id returns 400 for invalid ID format', async () => {
    const res = await request('/characters/INVALID');
    expect(res.status).toBe(400);

    const body = (await res.json()) as AnyJson;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Vehicles endpoints', () => {
  it('GET /vehicles returns all vehicles with dataVersion', async () => {
    const res = await request('/vehicles');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeDefined();

    const body = (await res.json()) as AnyJson;
    expect(body.dataVersion).toBeDefined();
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

    const body = (await res.json()) as AnyJson;
    expect(body.id).toBe('standard-bike');
    expect(body.tag).toBeDefined();
  });

  it('GET /vehicles/:id returns 404 for unknown vehicle', async () => {
    const res = await request('/vehicles/not-a-vehicle');
    expect(res.status).toBe(404);

    const body = (await res.json()) as AnyJson;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /vehicles/tag/:tag returns vehicles by tag', async () => {
    // First get a vehicle to find a valid tag
    const vehiclesRes = await request('/vehicles');
    const { vehicles } = (await vehiclesRes.json()) as AnyJson;
    const validTag = vehicles[0].tag;

    const res = await request(`/vehicles/tag/${validTag}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as AnyJson;
    expect(body.tag).toBe(validTag);
    expect(Array.isArray(body.vehicles)).toBe(true);
    expect(body.vehicles.length).toBeGreaterThan(0);
  });

  it('GET /vehicles/tag/:tag returns 404 for unknown tag', async () => {
    const res = await request('/vehicles/tag/not-a-tag');
    expect(res.status).toBe(404);

    const body = (await res.json()) as AnyJson;
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('Tracks endpoints', () => {
  it('GET /tracks returns all tracks with dataVersion', async () => {
    const res = await request('/tracks');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeDefined();

    const body = (await res.json()) as AnyJson;
    expect(body.dataVersion).toBeDefined();
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
    const { tracks } = (await tracksRes.json()) as AnyJson;
    const validId = tracks[0].id;

    const res = await request(`/tracks/${validId}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as AnyJson;
    expect(body.id).toBe(validId);
    expect(body.surfaceCoverage).toBeDefined();
  });

  it('GET /tracks/:id returns 404 for unknown track', async () => {
    const res = await request('/tracks/not-a-track');
    expect(res.status).toBe(404);

    const body = (await res.json()) as AnyJson;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /tracks/cup/:cup returns tracks by cup', async () => {
    const res = await request('/tracks/cup/mushroom-cup');
    expect(res.status).toBe(200);

    const body = (await res.json()) as AnyJson;
    expect(body.cup).toBeDefined();
    expect(Array.isArray(body.tracks)).toBe(true);
  });

  it('GET /tracks/cup/:cup returns 404 for unknown cup', async () => {
    const res = await request('/tracks/cup/not-a-cup');
    expect(res.status).toBe(404);

    const body = (await res.json()) as AnyJson;
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('Response headers', () => {
  it('includes X-Request-ID header', async () => {
    const res = await request('/health');
    expect(res.headers.get('X-Request-ID')).toBeDefined();
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
});

describe('304 Not Modified handling', () => {
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

    const body = (await res.json()) as AnyJson;
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBeDefined();
    expect(body.paths).toBeDefined();
    expect(body.components?.schemas).toBeDefined();
  });

  it('GET /openapi.json returns 304 when ETag matches', async () => {
    const firstRes = await request('/openapi.json');
    const etag = firstRes.headers.get('ETag');
    expect(etag).toBeDefined();

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

    const body = (await res.json()) as AnyJson;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.availableEndpoints).toBeDefined();
    expect(Array.isArray(body.availableEndpoints)).toBe(true);
  });
});
