import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { createRouter } from '../app';
import { API_CONFIG } from '../config';
import { checkNotModified } from '../utils';

/**
 * Creates the OpenAPI spec and docs routes.
 * Needs the main app instance to generate the spec from registered routes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocsRoutes(app: OpenAPIHono<any, any, any>) {
  const docsRouter = createRouter();

  docsRouter.get('/openapi.json', (c) => {
    const currentEtag = `"${API_CONFIG.serviceVersion}"`;
    c.header('ETag', currentEtag);
    c.header('Content-Type', 'application/json; charset=utf-8');

    if (checkNotModified(c, currentEtag)) {
      return c.body(null, 304);
    }

    const spec = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: {
        title: 'Mario Kart World Data API',
        version: API_CONFIG.serviceVersion,
        description: `
Free, community-maintained data API for Mario Kart World stats, combos, and track information.

**Data Source:** [Mario Kart World Statpedia](https://docs.google.com/spreadsheets/d/1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc/edit)

**Features:**
- Terrain-specific stats (road, rough, water)
- Surface coverage data for all tracks
- Vehicle grouping by stat tags
- Versioned data with ETags for efficient caching

**Rate Limits:** Requests may be rate limited by edge rules and return HTTP 429.

**Legal:** This is an unofficial, fan-created project. Not affiliated with Nintendo. Mario Kart is a registered trademark of Nintendo Co., Ltd.
        `.trim(),
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
          url: `https://hiddenvector.studio${API_CONFIG.basePath}`,
          description: 'Production',
        },
        {
          url: `http://localhost:8787${API_CONFIG.basePath}`,
          description: 'Local development',
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

    return c.json(spec);
  });

  docsRouter.get(
    '/docs',
    Scalar({
      url: `${API_CONFIG.basePath}/openapi.json`,
      pageTitle: 'Mario Kart World Data API Documentation',
    }),
  );

  return docsRouter;
}
