import { cors } from 'hono/cors';
import { createRouter } from './app';
import { API_CONFIG } from './config';
import { endpointNotFound, ErrorCode } from './errors';

// Route modules
import healthRouter from './routes/health';
import charactersRouter from './routes/characters';
import vehiclesRouter from './routes/vehicles';
import tracksRouter from './routes/tracks';
import { createDocsRoutes } from './routes/docs';

// ============================================================================
// App Setup
// ============================================================================

const app = createRouter().basePath(API_CONFIG.basePath);

// Global error handler for unexpected errors
app.onError((err, c) => {
  const requestId = c.get('requestId');
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        status: 500,
        ...(requestId && { requestId }),
      },
    },
    500,
  );
});

// ============================================================================
// Middleware
// ============================================================================

// Request ID - preserve from upstream or generate new
app.use('/*', async (c, next) => {
  const requestId = c.req.header('X-Request-ID') ?? crypto.randomUUID();
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
  // API version header
  c.header('API-Version', API_CONFIG.apiVersion);

  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // Don't send referrer for privacy
  c.header('Referrer-Policy', 'no-referrer');

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');

  // Content Security Policy
  if (c.req.path.endsWith('/docs')) {
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; font-src https://fonts.scalar.com; connect-src 'self' https://hiddenvector.studio; frame-ancestors 'none'",
    );
  } else {
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }

  await next();
});

// Cache control (applied after route handlers)
app.use('/*', async (c, next) => {
  await next();

  // Skip if already set or if it's a 304
  if (c.res.headers.get('Cache-Control') || c.res.status === 304) {
    return;
  }

  const path = c.req.path;

  if (path.endsWith('/docs')) {
    // Docs page: cache for 1 day
    c.header('Cache-Control', 'public, max-age=86400');
  } else if (path.endsWith('/openapi.json')) {
    // OpenAPI spec: cache for 1 day, revalidate on version change via ETag
    c.header('Cache-Control', 'public, max-age=86400');
  } else if (path.endsWith('/health')) {
    // Health endpoint: no caching (should always be fresh)
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    // Data endpoints: cache for 1 hour, but revalidate via ETag
    c.header('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
});

// ============================================================================
// Routes
// ============================================================================

app.route('/', healthRouter);
app.route('/', charactersRouter);
app.route('/', vehiclesRouter);
app.route('/', tracksRouter);
app.route('/', createDocsRoutes(app));

// ============================================================================
// 404 Handler
// ============================================================================

app.notFound((c) => {
  return endpointNotFound(c, c.req.path, [
    `GET ${API_CONFIG.basePath}/health`,
    `GET ${API_CONFIG.basePath}/characters`,
    `GET ${API_CONFIG.basePath}/characters/{id}`,
    `GET ${API_CONFIG.basePath}/vehicles`,
    `GET ${API_CONFIG.basePath}/vehicles/{id}`,
    `GET ${API_CONFIG.basePath}/vehicles?tag={tag}`,
    `GET ${API_CONFIG.basePath}/tracks`,
    `GET ${API_CONFIG.basePath}/tracks/{id}`,
    `GET ${API_CONFIG.basePath}/tracks?cup={cup}`,
  ]);
});

// ============================================================================
// Export
// ============================================================================

export default app;
