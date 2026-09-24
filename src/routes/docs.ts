import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { createRouter, type AppEnv } from '../app';
import { API_CONFIG } from '../config';
import { isNotModified, makeEtag } from '../utils';

const API_DESCRIPTION = `
Community-maintained data API for Mario Kart World stats, vehicles, and tracks.

**Data Source:** [Mario Kart World Statpedia](https://docs.google.com/spreadsheets/d/1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc/edit)

**Features:** terrain stats, track coverage, vehicle tag groupings, ETag caching.

**How to use the stats:**
- Stats are 0–11 in current data; higher is better.
- Use \`surfaceCoverage\` for raw surface breakdowns.
- Use \`terrainCoverage\` for combo calculations (normalized road/rough/water mix, excludes neutral/off-road).
- IDs are slugs; fetch list endpoints to discover valid IDs.

**Data contract:**
- \`dataVersion\` is the date of the last data import; use \`ETag\` for cache validation.
- \`terrainCoverage\` is derived from the adjusted coverage columns and sums to exactly 100 (2 decimal places).
- A small set of character names are normalized to US variants during parsing.
- \`?tag=\` and \`?cup=\` filters return an empty list when there are no matches; \`?cup=\` takes a track's \`cupId\`.

**Stability:** \`/v1\` is stable; breaking changes go to \`/v2\`.

**Rate Limits:** Requests are rate limited per client IP at Cloudflare's edge. Limited requests get HTTP 429 with a plain-text body (\`error code: 1015\`, not JSON) and a \`Retry-After\` header; check the status before parsing and wait that many seconds before retrying.

**Legal:** This is an unofficial, fan-created project. Not affiliated with Nintendo. Mario Kart is a registered trademark of Nintendo Co., Ltd.
`.trim();

/**
 * Creates the OpenAPI spec and docs routes.
 * Needs the main app instance to generate the spec from registered routes.
 */
export function createDocsRoutes(app: OpenAPIHono<AppEnv>) {
  const docsRouter = createRouter();

  // Routes are fully registered by the first request, so the spec is built once and reused.
  let cached: { spec: unknown; etag: string } | undefined;
  const getSpec = () => {
    if (!cached) {
      const spec = app.getOpenAPI31Document({
        openapi: '3.1.0',
        info: {
          title: 'Mario Kart World Data API',
          version: API_CONFIG.serviceVersion,
          description: API_DESCRIPTION,
          contact: {
            name: 'Hidden Vector Studio',
            url: 'https://hiddenvector.studio',
          },
          license: {
            name: 'CC-BY-4.0',
            url: 'https://creativecommons.org/licenses/by/4.0/',
          },
        },
        servers: [
          {
            url: 'https://hiddenvector.studio',
            description: 'Production',
          },
        ],
        externalDocs: {
          description: 'Interactive API documentation',
          url: `https://hiddenvector.studio${API_CONFIG.basePath}/docs`,
        },
        tags: [
          { name: 'Health', description: 'API health and status' },
          { name: 'Characters', description: 'Playable characters and their stats' },
          { name: 'Vehicles', description: 'Vehicles and their stats' },
          { name: 'Tracks', description: 'Race tracks and surface coverage data' },
        ],
      });
      cached = { spec, etag: makeEtag(API_CONFIG.serviceVersion, spec) };
    }
    return cached;
  };

  docsRouter.get('/openapi.json', (c) => {
    const { spec, etag } = getSpec();

    if (isNotModified(c, etag)) {
      return c.body(null, 304);
    }

    return c.json(spec);
  });

  docsRouter.get(
    '/docs',
    Scalar({
      url: `${API_CONFIG.basePath}/openapi.json`,
      pageTitle: 'Mario Kart World Data API Documentation',
      cdn: API_CONFIG.scalarCdn,
      // Features below call Scalar's hosted services, which the docs CSP blocks
      agent: { disabled: true },
      mcp: { disabled: true },
      telemetry: false,
    }),
  );

  return docsRouter;
}
