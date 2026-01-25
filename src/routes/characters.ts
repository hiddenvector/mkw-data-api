import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '../app';
import { notFound, ValidationErrorResponseSchema, NotFoundErrorResponseSchema } from '../errors';
import { CharacterIdParamSchema, CharactersResponseSchema, CharacterSchema } from '../schemas';
import { checkNotModified } from '../utils';
import { characters, dataVersion } from '../data';

const getCharactersRoute = createRoute({
  method: 'get',
  path: '/characters',
  tags: ['Characters'],
  summary: 'List All Characters',
  description:
    'Returns all playable characters with their stats. Supports ETag/If-None-Match for caching.',
  responses: {
    200: {
      content: { 'application/json': { schema: CharactersResponseSchema } },
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
  description: 'Returns a single character by their ID',
  request: { params: CharacterIdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: CharacterSchema } },
      description: 'Character found',
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
  const currentEtag = `"${dataVersion}"`;
  c.header('ETag', currentEtag);

  if (checkNotModified(c, currentEtag)) {
    return c.body(null, 304);
  }

  return c.json({ dataVersion, characters });
});

charactersRouter.openapi(getCharacterByIdRoute, (c) => {
  const { id } = c.req.valid('param');
  const character = characters.find((char) => char.id === id);

  if (!character) {
    return notFound(c, 'Character', id);
  }

  return c.json(character, 200);
});

export default charactersRouter;
