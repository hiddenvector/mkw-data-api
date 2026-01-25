import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import { notFound, ValidationErrorResponseSchema, NotFoundErrorResponseSchema } from '../errors';
import {
  TrackIdParamSchema,
  CupParamSchema,
  TracksResponseSchema,
  TrackSchema,
  TracksByCupResponseSchema,
} from '../schemas';
import { checkNotModified } from '../utils';
import { tracks, dataVersion } from '../data';

const getTracksRoute = createRoute({
  method: 'get',
  path: '/tracks',
  tags: ['Tracks'],
  summary: 'List All Tracks',
  description:
    'Returns all race tracks with surface coverage data. Supports ETag/If-None-Match for caching.',
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
  request: { params: TrackIdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: TrackSchema } },
      description: 'Track found',
    },
    400: {
      content: { 'application/json': { schema: ValidationErrorResponseSchema } },
      description: 'Invalid ID format',
    },
    404: {
      content: { 'application/json': { schema: NotFoundErrorResponseSchema } },
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
      content: { 'application/json': { schema: ValidationErrorResponseSchema } },
      description: 'Invalid cup format',
    },
    404: {
      content: { 'application/json': { schema: NotFoundErrorResponseSchema } },
      description: 'No tracks found in this cup',
    },
  },
});

const tracksRouter = createRouter();

const normalizeCup = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

tracksRouter.openapi(getTracksRoute, (c) => {
  const currentEtag = `"${dataVersion}"`;
  c.header('ETag', currentEtag);

  if (checkNotModified(c, currentEtag)) {
    return c.body(null, 304);
  }

  return c.json({ dataVersion, tracks });
});

tracksRouter.openapi(getTrackByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const track = tracks.find((t) => t.id === id);

  if (!track) {
    return notFound(c, 'Track', id);
  }

  return c.json(track, 200);
});

tracksRouter.openapi(getTracksByCupRoute, (c) => {
  const { cup } = c.req.valid('param');

  const normalizedCup = normalizeCup(cup);
  const byCup = tracks.filter((t) => normalizeCup(t.cup) === normalizedCup);

  if (byCup.length === 0) {
    return notFound(c, 'Tracks in cup', cup);
  }

  return c.json(
    {
      cup: byCup[0].cup,
      dataVersion,
      tracks: byCup,
    },
    200,
  );
});

export default tracksRouter;
