import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import {
  notFound,
  NotFoundErrorResponseSchema,
  rateLimitedResponse,
  ValidationErrorResponseSchema,
} from '../errors';
import {
  ConditionalRequestHeadersSchema,
  CupQuerySchema,
  EtagResponseHeadersSchema,
  TrackIdParamSchema,
  TracksResponseSchema,
  TrackSchema,
} from '../schemas';
import { isNotModified } from '../utils';
import { tracks, dataVersion, etags } from '../data';

const getTracksRoute = createRoute({
  method: 'get',
  path: '/tracks',
  tags: ['Tracks'],
  summary: 'List All Tracks',
  description:
    'Returns all race tracks with surface coverage data. Use ?cup= (a cupId) to filter. Supports ETag/If-None-Match for caching.',
  request: { query: CupQuerySchema, headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: TracksResponseSchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Success',
    },
    304: {
      description: 'Not Modified - use cached response',
    },
    400: {
      content: { 'application/json': { schema: ValidationErrorResponseSchema } },
      description: 'Invalid cup format',
    },
  },
});

const getTrackByIdRoute = createRoute({
  method: 'get',
  path: '/tracks/{id}',
  tags: ['Tracks'],
  summary: 'Get Track by ID',
  description: 'Returns a single track by its ID. Supports ETag/If-None-Match for caching.',
  request: { params: TrackIdParamSchema, headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: TrackSchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Track found',
    },
    304: {
      description: 'Not Modified - use cached response',
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

tracksRouter.openapi(getTracksRoute, (c) => {
  const { cup } = c.req.valid('query');

  if (isNotModified(c, etags.tracks)) {
    return c.body(null, 304);
  }

  const result = cup ? tracks.filter((t) => t.cupId === cup) : tracks;
  return c.json({ dataVersion, tracks: result }, 200);
});

tracksRouter.openapi(getTrackByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const track = tracks.find((t) => t.id === id);

  if (!track) {
    return notFound(c, 'Track', id);
  }

  if (isNotModified(c, etags.tracks)) {
    return c.body(null, 304);
  }

  return c.json(track, 200);
});

export default tracksRouter;
