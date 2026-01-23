import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Scalar } from '@scalar/hono-api-reference';
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

const app = new Hono().basePath('/mkw/api/v1');

// ============================================================================
// Middleware
// ============================================================================

// CORS - allow all origins
app.use('/*', cors());

// Cache control with security headers
app.use('/*', async (c, next) => {
  await next();

  // Set cache headers
  c.header('Cache-Control', 'public, max-age=3600'); // 1 hour
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dataVersion: (charactersData as CharactersResponse).dataVersion,
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
  Scalar({
    url: '/mkw/api/v1/openapi.json',
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
        'GET /mkw/api/v1/health',
        'GET /mkw/api/v1/characters',
        'GET /mkw/api/v1/characters/:id',
        'GET /mkw/api/v1/vehicles',
        'GET /mkw/api/v1/vehicles/:id',
        'GET /mkw/api/v1/vehicles/tag/:tag',
        'GET /mkw/api/v1/tracks',
        'GET /mkw/api/v1/tracks/:id',
        'GET /mkw/api/v1/tracks/cup/:cup',
      ],
    },
    404
  );
});

// ============================================================================
// Export
// ============================================================================

export default app;
