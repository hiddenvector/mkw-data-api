import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import {
  notFound,
  NotFoundErrorResponseSchema,
  rateLimitedResponse,
  ValidationErrorResponseSchema,
} from '../errors';
import {
  CharacterIdParamSchema,
  CharactersResponseSchema,
  CharacterSchema,
  ConditionalRequestHeadersSchema,
  EtagResponseHeadersSchema,
} from '../schemas';
import { isNotModified } from '../utils';
import { characters, dataVersion, etags } from '../data';

const getCharactersRoute = createRoute({
  method: 'get',
  path: '/characters',
  tags: ['Characters'],
  summary: 'List All Characters',
  description:
    'Returns all playable characters with their stats. Supports ETag/If-None-Match for caching.',
  request: { headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: CharactersResponseSchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Success',
    },
    304: {
      description: 'Not Modified - use cached response',
    },
  },
});

const getCharacterByIdRoute = createRoute({
  method: 'get',
  path: '/characters/{id}',
  tags: ['Characters'],
  summary: 'Get Character by ID',
  description: 'Returns a single character by their ID. Supports ETag/If-None-Match for caching.',
  request: { params: CharacterIdParamSchema, headers: ConditionalRequestHeadersSchema },
  responses: {
    429: rateLimitedResponse,
    200: {
      content: { 'application/json': { schema: CharacterSchema } },
      headers: EtagResponseHeadersSchema,
      description: 'Character found',
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
      description: 'Character not found',
    },
  },
});

const charactersRouter = createRouter();

charactersRouter.openapi(getCharactersRoute, (c) => {
  if (isNotModified(c, etags.characters)) {
    return c.body(null, 304);
  }

  return c.json({ dataVersion, characters }, 200);
});

charactersRouter.openapi(getCharacterByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const character = characters.find((char) => char.id === id);

  if (!character) {
    return notFound(c, 'Character', id);
  }

  if (isNotModified(c, etags.characters)) {
    return c.body(null, 304);
  }

  return c.json(character, 200);
});

export default charactersRouter;
