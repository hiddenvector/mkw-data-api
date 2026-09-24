import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from './app';
import { endpointNotFound, errorBody, ErrorCode, notFound } from './errors';

const makeApp = (requestId?: string) => {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    if (requestId) c.set('requestId', requestId);
    await next();
  });
  app.get('/not-found', (c) => notFound(c, 'Thing', 'missing'));
  app.get('/body', (c) => c.json(errorBody(c, ErrorCode.VALIDATION_ERROR, 'Bad input', 400), 400));
  app.notFound((c) => endpointNotFound(c, c.req.path, ['GET /known']));
  return app;
};

describe('error helpers', () => {
  it('returns structured not found errors', async () => {
    const res = await makeApp('test-request').request('/not-found');
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId?: string };
    };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe("Thing 'missing' not found");
    expect(body.error.requestId).toBe('test-request');
  });

  it('omits requestId when none is set', async () => {
    const res = await makeApp().request('/body');
    const body = (await res.json()) as { error: Record<string, unknown> };
    expect(body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'Bad input', status: 400 });
  });

  it('returns endpointNotFound with path and availableEndpoints', async () => {
    const res = await makeApp().request('/missing');
    const body = (await res.json()) as { availableEndpoints: string[]; path: string };
    expect(res.status).toBe(404);
    expect(body.path).toBe('/missing');
    expect(body.availableEndpoints).toEqual(['GET /known']);
  });
});
