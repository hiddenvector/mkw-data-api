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
  EtagResponseHeadersSchema,
  RalliesResponseSchema,
  RallyIdParamSchema,
  RallySchema,
} from '../schemas';
import { isNotModified } from '../utils';
import { rallies, dataVersion, etags } from '../data';

const getRalliesRoute = createRoute({
  method: 'get',
  path: '/rallies',
  tags: ['Rallies'],
  summary: 'List All Rallies',
  description:
    'Returns all released Knockout Tour rallies with surface coverage data. Supports ETag/If-None-Match for caching.',
  request: { headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: RalliesResponseSchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Success',
    },
    304: {
      description: 'Not Modified - use cached response',
    },
  },
});

const getRallyByIdRoute = createRoute({
  method: 'get',
  path: '/rallies/{id}',
  tags: ['Rallies'],
  summary: 'Get Rally by ID',
  description: 'Returns a single rally by its ID. Supports ETag/If-None-Match for caching.',
  request: { params: RallyIdParamSchema, headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: RallySchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Rally found',
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
      description: 'Rally not found',
    },
  },
});

const ralliesRouter = createRouter();

ralliesRouter.openapi(getRalliesRoute, (c) => {
  if (isNotModified(c, etags.rallies)) {
    return c.body(null, 304);
  }

  return c.json({ dataVersion, rallies }, 200);
});

ralliesRouter.openapi(getRallyByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const rally = rallies.find((r) => r.id === id);

  if (!rally) {
    return notFound(c, 'Rally', id);
  }

  if (isNotModified(c, etags.rallies)) {
    return c.body(null, 304);
  }

  return c.json(rally, 200);
});

export default ralliesRouter;
