import { cors } from 'hono/cors';
import { createRouter } from './app';
import { API_CONFIG } from './config';
import { endpointNotFound, ErrorCode, errorBody } from './errors';

// Route modules
import healthRouter from './routes/health';
import charactersRouter from './routes/characters';
import vehiclesRouter from './routes/vehicles';
import tracksRouter from './routes/tracks';
import ralliesRouter from './routes/rallies';
import mechanicsRouter from './routes/mechanics';
import { createDocsRoutes } from './routes/docs';

// ============================================================================
// App Setup
// ============================================================================

/** Accept upstream request IDs only if they are short and header/log-safe. */
const REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/;

const DOCS_CSP = [
  "default-src 'self'",
  `script-src 'unsafe-inline' ${API_CONFIG.scalarCdn}`,
  "style-src 'unsafe-inline'",
  'font-src https://fonts.scalar.com',
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

const API_CSP = "default-src 'none'; frame-ancestors 'none'";

/**
 * Cache policy for successful (2xx/304) responses. Errors are never cached.
 */
function cachePolicy(path: string): string {
  if (path.endsWith('/docs') || path.endsWith('/openapi.json')) {
    return 'public, max-age=86400';
  }
  if (path.endsWith('/health')) {
    return 'no-store';
  }
  // Data endpoints: cache for 1 hour, then revalidate via ETag
  return 'public, max-age=3600, must-revalidate';
}

export function createApp() {
  const app = createRouter().basePath(API_CONFIG.basePath);

  // Global error handler for unexpected errors
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json(errorBody(c, ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred', 500), 500);
  });

  // ============================================================================
  // Middleware
  // ============================================================================

  // Request ID - preserve a well-formed upstream ID or generate a new one
  app.use('/*', async (c, next) => {
    const upstream = c.req.header('X-Request-ID');
    const requestId =
      upstream && REQUEST_ID_PATTERN.test(upstream) ? upstream : crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    await next();
  });

  // Response time tracking
  app.use('/*', async (c, next) => {
    const start = performance.now();
    await next();
    const duration = performance.now() - start;
    c.header('X-Response-Time', `${duration.toFixed(2)}ms`);
  });

  // CORS
  app.use(
    '/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['If-None-Match', 'X-Request-ID'],
      exposeHeaders: ['ETag', 'X-Request-ID', 'X-Response-Time', 'API-Version'],
      maxAge: 86400,
    }),
  );

  // Security headers
  app.use('/*', async (c, next) => {
    c.header('API-Version', API_CONFIG.apiVersion);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Frame-Options', 'DENY');
    c.header('Content-Security-Policy', c.req.path.endsWith('/docs') ? DOCS_CSP : API_CSP);
    await next();
  });

  // Cache control (applied after route handlers)
  app.use('/*', async (c, next) => {
    await next();

    if (c.res.status >= 400) {
      // Never let a transient error (or a 404 during a deploy) stick in shared caches
      c.header('Cache-Control', 'no-store');
    } else {
      // Includes 304s, which must repeat the policy a 200 would carry (RFC 9110 §15.4.5)
      c.header('Cache-Control', cachePolicy(c.req.path));
    }
  });

  // ============================================================================
  // Routes
  // ============================================================================

  app.route('/', healthRouter);
  app.route('/', charactersRouter);
  app.route('/', vehiclesRouter);
  app.route('/', tracksRouter);
  app.route('/', ralliesRouter);
  app.route('/', mechanicsRouter);
  app.route('/', createDocsRoutes(app));

  // ============================================================================
  // 404 Handler
  // ============================================================================

  // Derived from the registered routes so it cannot drift from reality
  const availableEndpoints = [
    ...new Set(
      app.routes
        .filter((r) => r.method === 'GET')
        .map((r) => `GET ${r.path.replace(/:(\w+)/g, '{$1}')}`),
    ),
  ];

  app.notFound((c) => endpointNotFound(c, c.req.path, availableEndpoints));

  return app;
}

const app = createApp();

// ============================================================================
// Export
// ============================================================================

export default app;
