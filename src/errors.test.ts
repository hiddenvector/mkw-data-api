import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  invalidCup,
  invalidId,
  invalidTag,
  notFound,
  validationError,
  endpointNotFound,
} from './errors';

const makeApp = () => {
  const app = new Hono<{ Variables: { requestId: string } }>();
  app.use('*', async (c, next) => {
    c.set('requestId', 'test-request');
    await next();
  });
  app.get('/invalid-id', (c) => invalidId(c, 'INVALID'));
  app.get('/invalid-tag', (c) => invalidTag(c, 'INVALID'));
  app.get('/invalid-cup', (c) => invalidCup(c, 'INVALID'));
  app.get('/validation', (c) => validationError(c, 'Bad input'));
  app.get('/not-found', (c) => notFound(c, 'Thing', 'missing'));
  app.notFound((c) => endpointNotFound(c, c.req.path, ['GET /known']));
  return app;
};

describe('error helpers', () => {
  it('returns structured validation errors', async () => {
    const app = makeApp();
    const res = await app.request('/validation');
    const body = (await res.json()) as { error: { code: string; requestId?: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.requestId).toBe('test-request');
  });

  it('returns structured invalid id/tag/cup errors', async () => {
    const app = makeApp();
    const idRes = await app.request('/invalid-id');
    const idBody = (await idRes.json()) as { error: { code: string } };
    expect(idRes.status).toBe(400);
    expect(idBody.error.code).toBe('INVALID_ID');

    const tagRes = await app.request('/invalid-tag');
    const tagBody = (await tagRes.json()) as { error: { code: string } };
    expect(tagRes.status).toBe(400);
    expect(tagBody.error.code).toBe('INVALID_TAG');

    const cupRes = await app.request('/invalid-cup');
    const cupBody = (await cupRes.json()) as { error: { code: string } };
    expect(cupRes.status).toBe(400);
    expect(cupBody.error.code).toBe('INVALID_CUP');
  });

  it('returns structured not found errors', async () => {
    const app = makeApp();
    const res = await app.request('/not-found');
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('Thing');
  });

  it('returns endpointNotFound with path and availableEndpoints', async () => {
    const app = makeApp();
    const res = await app.request('/missing');
    const body = (await res.json()) as { availableEndpoints: string[]; path: string };
    expect(res.status).toBe(404);
    expect(body.path).toBe('/missing');
    expect(body.availableEndpoints).toEqual(['GET /known']);
  });
});
