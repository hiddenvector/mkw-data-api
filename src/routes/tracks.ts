import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import { notFound, ValidationErrorResponseSchema, NotFoundErrorResponseSchema } from '../errors';
import {
  TrackIdParamSchema,
  CupQuerySchema,
  TracksResponseSchema,
  TrackSchema,
} from '../schemas';
import { checkNotModified } from '../utils';
import { tracks, dataVersion } from '../data';

const getTracksRoute = createRoute({
  method: 'get',
  path: '/tracks',
  tags: ['Tracks'],
  summary: 'List All Tracks',
  description:
    'Returns all race tracks with surface coverage data. Use ?cup= to filter. Supports ETag/If-None-Match for caching.',
  request: { query: CupQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: TracksResponseSchema } },
      description: 'Success',
    },
    400: {
      content: { 'application/json': { schema: ValidationErrorResponseSchema } },
      description: 'Invalid cup format',
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

const tracksRouter = createRouter();

const normalizeStoredCup = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

tracksRouter.openapi(getTracksRoute, (c) => {
  const { cup } = c.req.valid('query');
  const currentEtag = `"${dataVersion}"`;
  c.header('ETag', currentEtag);

  if (checkNotModified(c, currentEtag)) {
    return c.body(null, 304);
  }

  if (cup) {
    const byCup = tracks.filter((t) => normalizeStoredCup(t.cup) === cup);
    return c.json({ dataVersion, tracks: byCup }, 200);
  }

  return c.json({ dataVersion, tracks }, 200);
});

tracksRouter.openapi(getTrackByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const track = tracks.find((t) => t.id === id);

  if (!track) {
    return notFound(c, 'Track', id);
  }

  return c.json(track, 200);
});

export default tracksRouter;
