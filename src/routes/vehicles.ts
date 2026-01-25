import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import { notFound, ValidationErrorResponseSchema, NotFoundErrorResponseSchema } from '../errors';
import {
  VehicleIdParamSchema,
  TagQuerySchema,
  VehiclesQueryResponseSchema,
  VehicleSchema,
} from '../schemas';
import { checkNotModified } from '../utils';
import { vehicles, dataVersion } from '../data';

const getVehiclesRoute = createRoute({
  method: 'get',
  path: '/vehicles',
  tags: ['Vehicles'],
  summary: 'List All Vehicles',
  description:
    'Returns all vehicles with their stats. Use ?tag= to filter. Supports ETag/If-None-Match for caching.',
  request: { query: TagQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: VehiclesQueryResponseSchema } },
      description: 'Success',
    },
    400: {
      content: { 'application/json': { schema: ValidationErrorResponseSchema } },
      description: 'Invalid tag format',
    },
    304: {
      description: 'Not Modified - use cached response',
    },
  },
});

const getVehicleByIdRoute = createRoute({
  method: 'get',
  path: '/vehicles/{id}',
  tags: ['Vehicles'],
  summary: 'Get Vehicle by ID',
  description: 'Returns a single vehicle by its ID',
  request: { params: VehicleIdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: VehicleSchema } },
      description: 'Vehicle found',
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
  const currentEtag = `"${dataVersion}"`;
  c.header('ETag', currentEtag);

  if (checkNotModified(c, currentEtag)) {
    return c.body(null, 304);
  }

  if (tag) {
    const byTag = vehicles.filter((veh) => veh.tag === tag);
    if (byTag.length === 0) {
      return notFound(c, 'Vehicles with tag', tag);
    }
    return c.json(
      {
        tag,
        dataVersion,
        vehicles: byTag,
      },
      200,
    );
  }

  return c.json({ dataVersion, vehicles }, 200);
});

vehiclesRouter.openapi(getVehicleByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const vehicle = vehicles.find((veh) => veh.id === id);

  if (!vehicle) {
    return notFound(c, 'Vehicle', id);
  }

  return c.json(vehicle, 200);
});

export default vehiclesRouter;
