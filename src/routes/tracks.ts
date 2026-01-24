import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import { notFound, ErrorResponseSchema } from '../errors';
import {
  IdParamSchema,
  CupParamSchema,
  TracksResponseSchema,
  TrackSchema,
  TracksByCupResponseSchema,
  type TracksResponse,
} from '../schemas';
import { checkNotModified } from '../utils';

import tracksData from '../../data/tracks.json';
import charactersData from '../../data/characters.json';

const { dataVersion } = charactersData;
const { tracks } = tracksData as TracksResponse;

const getTracksRoute = createRoute({
  method: 'get',
  path: '/tracks',
  tags: ['Tracks'],
  summary: 'List All Tracks',
  description: 'Returns all race tracks with surface coverage data. Supports ETag/If-None-Match for caching.',
  responses: {
    200: {
      content: { 'application/json': { schema: TracksResponseSchema } },
      description: 'Success',
    },
    304: {
      description: 'Not Modified - use cached response',
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

const tracksRouter = createRouter();

tracksRouter.openapi(getTracksRoute, (c) => {
  const currentEtag = `"${dataVersion}"`;
  c.header('ETag', currentEtag);

  if (checkNotModified(c, currentEtag)) {
    return c.body(null, 304);
  }

  return c.json({ dataVersion, tracks });
});

// @ts-expect-error - OpenAPIHono strict typing doesn't handle error response returns well
tracksRouter.openapi(getTrackByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const track = tracks.find((t) => t.id === id);

  if (!track) {
    return notFound(c, 'Track', id);
  }

  return c.json(track);
});

// @ts-expect-error - OpenAPIHono strict typing doesn't handle error response returns well
tracksRouter.openapi(getTracksByCupRoute, (c) => {
  const { cup } = c.req.valid('param');

  // Normalize cup name for matching (slug to display format)
  const normalizedCup = cup.replace(/-/g, ' ');
  const byCup = tracks.filter((t) => t.cup.toLowerCase() === normalizedCup);

  if (byCup.length === 0) {
    return notFound(c, 'Tracks in cup', cup);
  }

  return c.json({
    cup: byCup[0].cup,
    dataVersion,
    tracks: byCup,
  });
});

export default tracksRouter;
