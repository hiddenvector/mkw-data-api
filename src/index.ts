import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Scalar } from '@scalar/hono-api-reference';
import { API_CONFIG } from './config';
import { openApiSpec } from './openapi-spec';

import type {
  Character,
  Vehicle,
  Track,
  CharactersResponse,
  VehiclesResponse,
  TracksResponse
} from './types';

import charactersData from '../data/characters.json';
import vehiclesData from '../data/vehicles.json';
import tracksData from '../data/tracks.json';

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono().basePath(API_CONFIG.basePath);

// ============================================================================
// Middleware
// ============================================================================

// CORS - allow all origins
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  maxAge: 86400,
}));

// Cache control with security headers
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
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    apiVersion: API_CONFIG.apiVersion,
    serviceVersion: API_CONFIG.serviceVersion,
    timestamp: new Date().toISOString(),
    dataVersion: charactersData.dataVersion,
    dataLoaded: {
      characters: charactersData.characters.length,
      vehicles: vehiclesData.vehicles.length,
      tracks: tracksData.tracks.length,
    }
  });
});

// ============================================================================
// Characters Endpoints
// ============================================================================

/**
 * GET /characters
 * Returns all characters with their stats
 */
app.get('/characters', (c) => {
  const data = charactersData as CharactersResponse;
  c.header('ETag', `"${data.dataVersion}"`);
  return c.json(data);
});

/**
 * GET /characters/:id
 * Returns a single character by ID
 */
app.get('/characters/:id', (c) => {
  const id = c.req.param('id');
  const data = charactersData as CharactersResponse;
  const character = data.characters.find((char) => char.id === id);

  if (!character) {
    return c.json({ error: `Character '${id}' not found` }, 404);
  }

  return c.json(character);
});

// ============================================================================
// Vehicles Endpoints
// ============================================================================

/**
 * GET /vehicles
 * Returns all vehicles with their stats
 */
app.get('/vehicles', (c) => {
  const data = vehiclesData as VehiclesResponse;
  c.header('ETag', `"${data.dataVersion}"`);
  return c.json(data);
});

/**
 * GET /vehicles/tag/:tag
 * Returns all vehicles with a specific tag (same stats)
 */
app.get('/vehicles/tag/:tag', (c) => {
  const tag = c.req.param('tag').toLowerCase();
  const data = vehiclesData as VehiclesResponse;
  const vehicles = data.vehicles.filter((veh) => veh.tag === tag);

  if (vehicles.length === 0) {
    return c.json({ error: `No vehicles found with tag '${tag}'` }, 404);
  }

  return c.json({
    tag,
    dataVersion: data.dataVersion,
    vehicles,
  });
});

/**
 * GET /vehicles/:id
 * Returns a single vehicle by ID
 */
app.get('/vehicles/:id', (c) => {
  const id = c.req.param('id');
  const data = vehiclesData as VehiclesResponse;
  const vehicle = data.vehicles.find((veh) => veh.id === id);

  if (!vehicle) {
    return c.json({ error: `Vehicle '${id}' not found` }, 404);
  }

  return c.json(vehicle);
});

// ============================================================================
// Tracks Endpoints
// ============================================================================

/**
 * GET /tracks
 * Returns all tracks with surface coverage data
 */
app.get('/tracks', (c) => {
  const data = tracksData as TracksResponse;
  c.header('ETag', `"${data.dataVersion}"`);
  return c.json(data);
});

/**
 * GET /tracks/cup/:cup
 * Returns all tracks in a specific cup
 */
app.get('/tracks/cup/:cup', (c) => {
  const cup = c.req.param('cup');
  const data = tracksData as TracksResponse;

  // Normalize cup name for matching (case-insensitive, handle spaces)
  const normalizedCup = cup.toLowerCase().replace(/-/g, ' ');
  const tracks = data.tracks.filter((t) =>
    t.cup.toLowerCase() === normalizedCup
  );

  if (tracks.length === 0) {
    return c.json({ error: `No tracks found in cup '${cup}'` }, 404);
  }

  return c.json({
    cup: tracks[0].cup, // Use proper capitalization from data
    dataVersion: data.dataVersion,
    tracks,
  });
});

/**
 * GET /tracks/:id
 * Returns a single track by ID
 */
app.get('/tracks/:id', (c) => {
  const id = c.req.param('id');
  const data = tracksData as TracksResponse;
  const track = data.tracks.find((t) => t.id === id);

  if (!track) {
    return c.json({ error: `Track '${id}' not found` }, 404);
  }

  return c.json(track);
});

// ============================================================================
// API Documentation
// ============================================================================

// Serve the OpenAPI spec as JSON
app.get('/openapi.json', (c) => {
  c.header('Cache-Control', 'public, max-age=86400, immutable');
  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('ETag', '"v1"');
  return c.json(openApiSpec);
});

/**
 * GET /docs
 * Interactive API documentation powered by Scalar
 */
app.get(
  '/docs',
  async (c, next) => {
    c.header('Cache-Control', 'public, max-age=86400');
    await next();
  },
  Scalar({
    content: openApiSpec,
    pageTitle: 'Mario Kart World Data API Documentation',
  })
);

// ============================================================================
// 404 Handler
// ============================================================================

app.notFound((c) => {
  return c.json(
    {
      error: 'Endpoint not found',
      path: c.req.path,
      availableEndpoints: [
        `GET ${API_CONFIG.basePath}/health`,
        `GET ${API_CONFIG.basePath}/characters`,
        `GET ${API_CONFIG.basePath}/characters/:id`,
        `GET ${API_CONFIG.basePath}/vehicles`,
        `GET ${API_CONFIG.basePath}/vehicles/:id`,
        `GET ${API_CONFIG.basePath}/vehicles/tag/:tag`,
        `GET ${API_CONFIG.basePath}/tracks`,
        `GET ${API_CONFIG.basePath}/tracks/:id`,
        `GET ${API_CONFIG.basePath}/tracks/cup/:cup`,
      ],
    },
    404
  );
});

// ============================================================================
// Export
// ============================================================================

export default app;
