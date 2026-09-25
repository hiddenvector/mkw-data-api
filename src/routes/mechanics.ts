import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import { rateLimitedResponse } from '../errors';
import {
  ConditionalRequestHeadersSchema,
  EtagResponseHeadersSchema,
  MechanicsResponseSchema,
} from '../schemas';
import { isNotModified } from '../utils';
import { mechanics, etags } from '../data';

const getMechanicsRoute = createRoute({
  method: 'get',
  path: '/mechanics',
  tags: ['Mechanics'],
  summary: 'Stat Mechanics',
  description:
    'Tables converting combo stat levels (character stat + vehicle stat) into in-game values: speed, coin bonus, acceleration, boost durations, and turning. Each array is indexed by level. Supports ETag/If-None-Match for caching.',
  request: { headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: MechanicsResponseSchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Success',
    },
    304: {
      description: 'Not Modified - use cached response',
    },
  },
});

const mechanicsRouter = createRouter();

mechanicsRouter.openapi(getMechanicsRoute, (c) => {
  if (isNotModified(c, etags.mechanics)) {
    return c.body(null, 304);
  }

  return c.json(mechanics, 200);
});

export default mechanicsRouter;
