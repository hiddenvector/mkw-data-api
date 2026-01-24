import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { Scalar } from '@scalar/hono-api-reference';
import { ZodError } from 'zod';
import { API_CONFIG } from './config';
import { endpointNotFound, notFound, ErrorResponseSchema, ErrorCode } from './errors';
import {
  // Path param schemas
  IdParamSchema,
  TagParamSchema,
  CupParamSchema,
  // Response schemas
  HealthResponseSchema,
  CharactersResponseSchema,
  CharacterSchema,
  VehiclesResponseSchema,
  VehicleSchema,
  VehiclesByTagResponseSchema,
  TracksResponseSchema,
  TrackSchema,
  TracksByCupResponseSchema,
  // Types
  type CharactersResponse,
  type VehiclesResponse,
  type TracksResponse,
} from './schemas';

// Type for app-level variables stored in context
type AppVariables = {
  requestId: string;
};

import charactersData from '../data/characters.json';
import vehiclesData from '../data/vehicles.json';
import tracksData from '../data/tracks.json';

// Cast data once at startup
const { dataVersion, characters } = charactersData as CharactersResponse;
const { vehicles } = vehiclesData as VehiclesResponse;
const { tracks } = tracksData as TracksResponse;

// ============================================================================
// App Setup
// ============================================================================

const app = new OpenAPIHono<{ Variables: AppVariables }>({
  // Transform Zod validation errors into structured format
  defaultHook: (result, c) => {
    if (!result.success) {
      const requestId = c.get('requestId');
      const messages = result.error.issues.map((issue) => issue.message).join('; ');
      return c.json(
        {
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: messages,
            status: 400,
            ...(requestId && { requestId }),
          },
        },
        400
      );
    }
  },
}).basePath(API_CONFIG.basePath);

// Global error handler for unexpected errors
app.onError((err, c) => {
  const requestId = c.get('requestId');
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        status: 500,
        ...(requestId && { requestId }),
      },
    },
    500
  );
});

// ============================================================================
// Middleware
// ============================================================================

// Request ID middleware - check for existing header or generate new
app.use('/*', async (c, next) => {
  const requestId = c.req.header('X-Request-ID') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
});

// Response time middleware
app.use('/*', async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  c.header('X-Response-Time', `${duration.toFixed(2)}ms`);
});

// CORS - allow all origins
app.use(
  '/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'OPTIONS'],
    maxAge: 86400,
  })
);

// Security headers and cache control
app.use('/*', async (c, next) => {
  c.header('API-Version', API_CONFIG.apiVersion);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');

  if (!c.req.path.endsWith('/docs')) {
    c.header('X-Frame-Options', 'DENY');
  }

  await next();

  if (!c.req.path.includes('/docs') && !c.req.path.includes('/openapi.json')) {
    c.header('Cache-Control', 'public, max-age=3600');
  }
});

// ============================================================================
// Route Definitions
// ============================================================================

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Health Check',
  description: 'Returns API status, version, and current data version',
  responses: {
    200: {
      content: { 'application/json': { schema: HealthResponseSchema } },
      description: 'API is healthy',
    },
  },
});

const getCharactersRoute = createRoute({
  method: 'get',
  path: '/characters',
  tags: ['Characters'],
  summary: 'List All Characters',
  description: 'Returns all playable characters with their stats',
  responses: {
    200: {
      content: { 'application/json': { schema: CharactersResponseSchema } },
      description: 'Success',
    },
  },
});

const getCharacterByIdRoute = createRoute({
  method: 'get',
  path: '/characters/{id}',
  tags: ['Characters'],
  summary: 'Get Character by ID',
  description: 'Returns a single character by their ID',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: CharacterSchema } },
      description: 'Character found',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid ID format',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Character not found',
    },
  },
});

const getVehiclesRoute = createRoute({
  method: 'get',
  path: '/vehicles',
  tags: ['Vehicles'],
  summary: 'List All Vehicles',
  description: 'Returns all vehicles (karts, bikes, ATVs) with their stats',
  responses: {
    200: {
      content: { 'application/json': { schema: VehiclesResponseSchema } },
      description: 'Success',
    },
  },
});

const getVehicleByIdRoute = createRoute({
  method: 'get',
  path: '/vehicles/{id}',
  tags: ['Vehicles'],
  summary: 'Get Vehicle by ID',
  description: 'Returns a single vehicle by its ID',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: VehicleSchema } },
      description: 'Vehicle found',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid ID format',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Vehicle not found',
    },
  },
});

const getVehiclesByTagRoute = createRoute({
  method: 'get',
  path: '/vehicles/tag/{tag}',
  tags: ['Vehicles'],
  summary: 'Get Vehicles by Tag',
  description: 'Returns all vehicles that share the same tag (identical stats)',
  request: { params: TagParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: VehiclesByTagResponseSchema } },
      description: 'Vehicles found',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid tag format',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No vehicles found with this tag',
    },
  },
});

const getTracksRoute = createRoute({
  method: 'get',
  path: '/tracks',
  tags: ['Tracks'],
  summary: 'List All Tracks',
  description: 'Returns all race tracks with surface coverage data',
  responses: {
    200: {
      content: { 'application/json': { schema: TracksResponseSchema } },
      description: 'Success',
    },
  },
});

const getTrackByIdRoute = createRoute({
  method: 'get',
  path: '/tracks/{id}',
  tags: ['Tracks'],
  summary: 'Get Track by ID',
  description: 'Returns a single track by its ID',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: TrackSchema } },
      description: 'Track found',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid ID format',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Track not found',
    },
  },
});

const getTracksByCupRoute = createRoute({
  method: 'get',
  path: '/tracks/cup/{cup}',
  tags: ['Tracks'],
  summary: 'Get Tracks by Cup',
  description: 'Returns all tracks in a specific cup',
  request: { params: CupParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: TracksByCupResponseSchema } },
      description: 'Tracks found',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid cup format',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No tracks found in this cup',
    },
  },
});

// ============================================================================
// Route Handlers
// ============================================================================

app.openapi(healthRoute, (c) => {
  return c.json({
    status: 'ok' as const,
    apiVersion: API_CONFIG.apiVersion,
    serviceVersion: API_CONFIG.serviceVersion,
    timestamp: new Date().toISOString(),
    dataVersion,
    dataLoaded: {
      characters: characters.length,
      vehicles: vehicles.length,
      tracks: tracks.length,
    },
  });
});

app.openapi(getCharactersRoute, (c) => {
  c.header('ETag', `"${dataVersion}"`);
  return c.json({ dataVersion, characters });
});

app.openapi(getCharacterByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const character = characters.find((char) => char.id === id);

  if (!character) {
    return notFound(c, 'Character', id) as any;
  }

  return c.json(character);
});

app.openapi(getVehiclesRoute, (c) => {
  c.header('ETag', `"${dataVersion}"`);
  return c.json({ dataVersion, vehicles });
});

app.openapi(getVehicleByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const vehicle = vehicles.find((veh) => veh.id === id);

  if (!vehicle) {
    return notFound(c, 'Vehicle', id) as any;
  }

  return c.json(vehicle);
});

app.openapi(getVehiclesByTagRoute, (c) => {
  const { tag } = c.req.valid('param');
  const byTag = vehicles.filter((veh) => veh.tag === tag);

  if (byTag.length === 0) {
    return notFound(c, 'Vehicles with tag', tag) as any;
  }

  return c.json({
    tag,
    dataVersion,
    vehicles: byTag,
  });
});

app.openapi(getTracksRoute, (c) => {
  c.header('ETag', `"${dataVersion}"`);
  return c.json({ dataVersion, tracks });
});

app.openapi(getTrackByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const track = tracks.find((t) => t.id === id);

  if (!track) {
    return notFound(c, 'Track', id) as any;
  }

  return c.json(track);
});

app.openapi(getTracksByCupRoute, (c) => {
  const { cup } = c.req.valid('param');

  // Normalize cup name for matching (slug to display format)
  const normalizedCup = cup.replace(/-/g, ' ');
  const byCup = tracks.filter((t) => t.cup.toLowerCase() === normalizedCup);

  if (byCup.length === 0) {
    return notFound(c, 'Tracks in cup', cup) as any;
  }

  return c.json({
    cup: byCup[0].cup, // Use proper capitalization from data
    dataVersion,
    tracks: byCup,
  });
});

// ============================================================================
// API Documentation
// ============================================================================

// Serve the auto-generated OpenAPI spec
app.get('/openapi.json', (c) => {
  c.header('Cache-Control', 'public, max-age=86400, immutable');
  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('ETag', `"${API_CONFIG.serviceVersion}"`);

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
    ],
    tags: [
      { name: 'Health', description: 'API health and status' },
      { name: 'Characters', description: 'Playable characters and their stats' },
      { name: 'Vehicles', description: 'Karts, bikes, and ATVs with their stats' },
      { name: 'Tracks', description: 'Race tracks and surface coverage data' },
    ],
  });

  return c.json(spec);
});

// Interactive API documentation
app.get(
  '/docs',
  async (c, next) => {
    c.header('Cache-Control', 'public, max-age=86400');
    await next();
  },
  Scalar({
    url: `${API_CONFIG.basePath}/openapi.json`,
    pageTitle: 'Mario Kart World Data API Documentation',
  })
);

// ============================================================================
// 404 Handler
// ============================================================================

app.notFound((c) => {
  return endpointNotFound(c, c.req.path, [
    `GET ${API_CONFIG.basePath}/health`,
    `GET ${API_CONFIG.basePath}/characters`,
    `GET ${API_CONFIG.basePath}/characters/{id}`,
    `GET ${API_CONFIG.basePath}/vehicles`,
    `GET ${API_CONFIG.basePath}/vehicles/{id}`,
    `GET ${API_CONFIG.basePath}/vehicles/tag/{tag}`,
    `GET ${API_CONFIG.basePath}/tracks`,
    `GET ${API_CONFIG.basePath}/tracks/{id}`,
    `GET ${API_CONFIG.basePath}/tracks/cup/{cup}`,
  ]);
});

// ============================================================================
// Export
// ============================================================================

export default app;
