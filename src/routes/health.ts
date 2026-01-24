import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import { API_CONFIG } from '../config';
import { HealthResponseSchema, type CharactersResponse, type VehiclesResponse, type TracksResponse } from '../schemas';

import charactersData from '../../data/characters.json';
import vehiclesData from '../../data/vehicles.json';
import tracksData from '../../data/tracks.json';

const { dataVersion, characters } = charactersData as CharactersResponse;
const { vehicles } = vehiclesData as VehiclesResponse;
const { tracks } = tracksData as TracksResponse;

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

const health = createRouter();

health.openapi(healthRoute, (c) => {
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

export default health;
