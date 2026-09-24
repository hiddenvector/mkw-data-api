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
  TagQuerySchema,
  VehicleIdParamSchema,
  VehiclesResponseSchema,
  VehicleSchema,
} from '../schemas';
import { isNotModified } from '../utils';
import { vehicles, dataVersion, etags } from '../data';

const getVehiclesRoute = createRoute({
  method: 'get',
  path: '/vehicles',
  tags: ['Vehicles'],
  summary: 'List All Vehicles',
  description:
    'Returns all vehicles with their stats. Use ?tag= to filter. Supports ETag/If-None-Match for caching.',
  request: { query: TagQuerySchema, headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: VehiclesResponseSchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Success',
    },
    304: {
      description: 'Not Modified - use cached response',
    },
    400: {
      content: { 'application/json': { schema: ValidationErrorResponseSchema } },
      description: 'Invalid tag format',
    },
  },
});

const getVehicleByIdRoute = createRoute({
  method: 'get',
  path: '/vehicles/{id}',
  tags: ['Vehicles'],
  summary: 'Get Vehicle by ID',
  description: 'Returns a single vehicle by its ID. Supports ETag/If-None-Match for caching.',
  request: { params: VehicleIdParamSchema, headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: VehicleSchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Vehicle found',
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
      description: 'Vehicle not found',
    },
  },
});

const vehiclesRouter = createRouter();

vehiclesRouter.openapi(getVehiclesRoute, (c) => {
  const { tag } = c.req.valid('query');

  if (isNotModified(c, etags.vehicles)) {
    return c.body(null, 304);
  }

  const result = tag ? vehicles.filter((veh) => veh.tag === tag) : vehicles;
  return c.json({ dataVersion, vehicles: result }, 200);
});

vehiclesRouter.openapi(getVehicleByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const vehicle = vehicles.find((veh) => veh.id === id);

  if (!vehicle) {
    return notFound(c, 'Vehicle', id);
  }

  if (isNotModified(c, etags.vehicles)) {
    return c.body(null, 304);
  }

  return c.json(vehicle, 200);
});

export default vehiclesRouter;
