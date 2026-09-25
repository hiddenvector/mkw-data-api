#!/usr/bin/env tsx
/**
 * Smoke test against a running deployment.
 *
 * Expectations come from the repo itself (package.json, DATA_VERSION, data/*.json),
 * so the same script works for every release without edits.
 *
 * Usage:
 *   npm run smoke                                            # production
 *   SMOKE_BASE_URL=http://localhost:8787/mkw/api/v1 npm run smoke   # wrangler dev
 *
 * Env:
 *   SMOKE_BASE_URL       API base URL (default: production)
 *   SMOKE_WAIT_SECONDS   How long to wait for /health to report this version (default: 90)
 *   SMOKE_DELAY_MS       Pause between requests, to stay under edge rate limits (default: 500)
 *
 * Production sits behind Cloudflare rate limiting. Requests are paced, and a 429 is
 * retried with backoff (honoring Retry-After) rather than reported as a failed check.
 */

import { pathToFileURL } from 'node:url';
import packageJson from '../package.json';
import charactersData from '../data/characters.json';
import vehiclesData from '../data/vehicles.json';
import tracksData from '../data/tracks.json';
import ralliesData from '../data/rallies.json';
import mechanicsData from '../data/mechanics.json';
import { DATA_VERSION } from '../src/data-version';

const BASE_URL = (process.env.SMOKE_BASE_URL ?? 'https://hiddenvector.studio/mkw/api/v1').replace(
  /\/+$/,
  '',
);
const WAIT_SECONDS = Number(process.env.SMOKE_WAIT_SECONDS ?? 90);
const DELAY_MS = Number(process.env.SMOKE_DELAY_MS ?? 500);
const MAX_RATE_LIMIT_RETRIES = 4;

const expected = {
  serviceVersion: packageJson.version,
  dataVersion: DATA_VERSION,
  counts: {
    characters: charactersData.characters.length,
    vehicles: vehiclesData.vehicles.length,
    tracks: tracksData.tracks.length,
    rallies: ralliesData.rallies.length,
  },
  character: charactersData.characters[0],
  vehicle: vehiclesData.vehicles[0],
  track: tracksData.tracks[0],
};

// ============================================================================
// Helpers
// ============================================================================

type Json = Record<string, unknown>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Paced fetch that backs off on 429 (edge rate limiting) instead of failing the check.
 */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await sleep(DELAY_MS);
    const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual', ...init });
    if (res.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) return res;

    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 10_000 * (attempt + 1);
    console.log(`   ⏳ rate limited on ${path}; retrying in ${Math.round(waitMs / 1000)}s`);
    await res.body?.cancel();
    await sleep(waitMs);
  }
}

const get = (path: string, headers: Record<string, string> = {}) => request(path, { headers });

class CheckError extends Error {}

/** Cloudflare challenged the request (Bot Fight Mode, a WAF rule…). Waiting won't clear it. */
class ChallengedError extends Error {}

/**
 * Parses a JSON response, or throws an error describing what came back instead: status,
 * content type, Cloudflare's mitigation header and ray ID, and the HTML page title.
 */
async function readJson(res: Response, path: string): Promise<Json> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return (await res.json()) as Json;

  const body = await res.text();
  const title = /<title>([^<]*)<\/title>/i.exec(body)?.[1]?.trim();
  const mitigated = res.headers.get('cf-mitigated');
  const ray = res.headers.get('cf-ray');
  const detail = [
    `HTTP ${res.status}`,
    contentType || 'no content-type',
    mitigated && `cf-mitigated: ${mitigated}`,
    ray && `cf-ray: ${ray}`,
    title ? `page title "${title}"` : body && `body "${body.slice(0, 60).replace(/\s+/g, ' ')}"`,
  ]
    .filter(Boolean)
    .join(', ');

  const message = `${path}: expected JSON, got ${detail}`;
  if (mitigated === 'challenge') {
    throw new ChallengedError(
      `${message}. Cloudflare challenged the request (e.g. Bot Fight Mode or a WAF rule), which automated clients can't pass. Check Security → Events for the ray ID.`,
    );
  }
  throw new CheckError(message);
}

const getJson = async (path: string) => readJson(await get(path), path);

/**
 * True if the ETag has the form "<serviceVersion>-<hash>" (optionally weak). The version is
 * compared as a plain string, so no user-controlled text ends up inside a RegExp.
 */
function isCurrentEtag(etag: string): boolean {
  const match = /^(?:W\/)?"(.+)-[0-9a-z]+"$/.exec(etag);
  return match?.[1] === expected.serviceVersion;
}
const DATA_CACHE_CONTROL = 'public, max-age=3600, must-revalidate';

function expect(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new CheckError(detail);
}

function expectEqual(actual: unknown, wanted: unknown, label = 'value') {
  expect(
    JSON.stringify(actual) === JSON.stringify(wanted),
    `${label}: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`,
  );
}

/**
 * Polls /health until it reports this service version. Covers edge propagation after a
 * deploy and server startup for local runs (connection errors are retried).
 */
async function waitForVersion(): Promise<void> {
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const health = await getJson('/health');
      if (health.serviceVersion === expected.serviceVersion) return;
      last = `serviceVersion ${String(health.serviceVersion)}`;
    } catch (err) {
      // A challenge is a configuration problem, not propagation delay: fail now, not in 90s
      if (err instanceof ChallengedError) throw err;
      last = err instanceof Error ? err.message : String(err);
    }
    await sleep(3000);
  }
  throw new Error(
    `${BASE_URL}/health did not report ${expected.serviceVersion} within ${WAIT_SECONDS}s (last: ${last})`,
  );
}

// ============================================================================
// Checks
// ============================================================================

const checks: Array<[name: string, run: () => Promise<void>]> = [
  [
    'health reports expected versions and counts',
    async () => {
      const res = await get('/health');
      const body = await readJson(res, '/health');
      expectEqual(res.status, 200, 'status');
      expectEqual(res.headers.get('cache-control'), 'no-store', 'cache-control');
      expectEqual(body.status, 'ok', 'status field');
      expectEqual(body.dataVersion, expected.dataVersion, 'dataVersion');
      expectEqual(body.dataLoaded, expected.counts, 'dataLoaded');
    },
  ],
  ...(['characters', 'vehicles', 'tracks', 'rallies'] as const).map(
    (collection): [string, () => Promise<void>] => [
      `/${collection} serves ETag and revalidates to 304`,
      async () => {
        const res = await get(`/${collection}`);
        const body = await readJson(res, `/${collection}`);
        expectEqual(res.status, 200, 'status');
        expectEqual(res.headers.get('cache-control'), DATA_CACHE_CONTROL, 'cache-control');
        const etag = res.headers.get('etag') ?? '';
        expect(isCurrentEtag(etag), `unexpected ETag ${etag}`);
        expectEqual((body[collection] as unknown[]).length, expected.counts[collection], 'count');

        const revalidated = await get(`/${collection}`, { 'If-None-Match': etag });
        expectEqual(revalidated.status, 304, '304 status');
        expectEqual(
          revalidated.headers.get('cache-control'),
          DATA_CACHE_CONTROL,
          '304 cache-control',
        );
      },
    ],
  ),
  [
    'item endpoints return the expected entities',
    async () => {
      const character = await getJson(`/characters/${expected.character.id}`);
      expectEqual(character.name, expected.character.name, 'character name');
      const vehicle = await getJson(`/vehicles/${expected.vehicle.id}`);
      expectEqual(vehicle.tag, expected.vehicle.tag, 'vehicle tag');
      const track = await getJson(`/tracks/${expected.track.id}`);
      expectEqual(track.cupId, expected.track.cupId, 'track cupId');
    },
  ],
  [
    'item endpoints revalidate to 304',
    async () => {
      const path = `/tracks/${expected.track.id}`;
      const etag = (await get(path)).headers.get('etag') ?? '';
      expect(isCurrentEtag(etag), `unexpected ETag ${etag}`);
      expectEqual((await get(path, { 'If-None-Match': etag })).status, 304, '304 status');
    },
  ],
  [
    'filters match the data files',
    async () => {
      const { cupId } = expected.track;
      const byCup = (await getJson(`/tracks?cup=${cupId}`)).tracks as Json[];
      const wantedCup = tracksData.tracks.filter((t) => t.cupId === cupId).map((t) => t.id);
      expectEqual(
        byCup.map((t) => t.id),
        wantedCup,
        `?cup=${cupId}`,
      );

      const { tag } = expected.vehicle;
      const byTag = (await getJson(`/vehicles?tag=${tag}`)).vehicles as Json[];
      const wantedTag = vehiclesData.vehicles.filter((v) => v.tag === tag).map((v) => v.id);
      expectEqual(
        byTag.map((v) => v.id),
        wantedTag,
        `?tag=${tag}`,
      );

      expectEqual(
        ((await getJson('/tracks?cup=not-a-cup')).tracks as unknown[]).length,
        0,
        'unknown cup',
      );
    },
  ],
  [
    '/mechanics matches the data file and revalidates to 304',
    async () => {
      const res = await get('/mechanics');
      const body = await readJson(res, '/mechanics');
      expectEqual(res.status, 200, 'status');
      expectEqual(body, mechanicsData, 'body');
      const etag = res.headers.get('etag') ?? '';
      expect(isCurrentEtag(etag), `unexpected ETag ${etag}`);
      expectEqual((await get('/mechanics', { 'If-None-Match': etag })).status, 304, '304 status');
    },
  ],
  [
    'errors are structured and never cached',
    async () => {
      for (const [path, status, code] of [
        ['/characters/not-a-character', 404, 'NOT_FOUND'],
        ['/characters/INVALID', 400, 'VALIDATION_ERROR'],
        ['/not-an-endpoint', 404, 'NOT_FOUND'],
      ] as const) {
        const res = await get(path);
        const body = (await readJson(res, path)) as { error?: Json };
        expectEqual(res.status, status, `${path} status`);
        expectEqual(res.headers.get('cache-control'), 'no-store', `${path} cache-control`);
        expectEqual(body.error?.code, code, `${path} error code`);
      }
    },
  ],
  [
    'X-Request-ID is echoed when valid and replaced when not',
    async () => {
      const kept = await get('/health', { 'X-Request-ID': 'smoke-test.1' });
      expectEqual(kept.headers.get('x-request-id'), 'smoke-test.1', 'valid ID');
      const replaced = await get('/health', { 'X-Request-ID': 'not valid!' });
      const id = replaced.headers.get('x-request-id') ?? '';
      expect(/^[0-9a-f-]{36}$/.test(id), `invalid ID was not replaced (got ${id})`);
    },
  ],
  [
    'OpenAPI spec and docs are served',
    async () => {
      const spec = await getJson('/openapi.json');
      expectEqual((spec.info as Json).version, expected.serviceVersion, 'spec version');
      const docs = await get('/docs');
      expectEqual(docs.status, 200, '/docs status');
      const csp = docs.headers.get('content-security-policy') ?? '';
      const src = /<script[^>]+src="([^"]+)"/.exec(await docs.text())?.[1];
      expect(src && csp.includes(src), `docs script ${src} not allowed by CSP`);
    },
  ],
  [
    'CORS preflight allows any origin',
    async () => {
      const res = await request('/characters', {
        method: 'OPTIONS',
        headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'GET' },
      });
      expectEqual(res.headers.get('access-control-allow-origin'), '*', 'allow-origin');
    },
  ],
];

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<number> {
  console.log(`🔎 Smoke testing ${BASE_URL} (expecting ${expected.serviceVersion})\n`);
  await waitForVersion();

  let failed = 0;
  for (const [name, run] of checks) {
    try {
      await run();
      console.log(`✅ ${name}`);
    } catch (err) {
      failed++;
      console.log(`❌ ${name}\n   ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('❌ Fatal error:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
