/**
 * Structured error handling for Mario Kart World Data API
 */

import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { AppEnv } from './app';

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// Error Response Schema
// ============================================================================

const BaseErrorSchema = z.object({
  error: z.object({
    code: z.string().openapi({ description: 'Machine-readable error code' }),
    message: z.string().openapi({ description: 'Human-readable error message' }),
    status: z.number().int().openapi({ description: 'HTTP status code' }),
    requestId: z.string().optional().openapi({
      description: 'Request ID for debugging (if available)',
    }),
  }),
});

/**
 * 400 Bad Request error response schema.
 * Example: Invalid ID format (e.g., contains uppercase or special characters).
 */
export const ValidationErrorResponseSchema = BaseErrorSchema.openapi('ValidationErrorResponse', {
  example: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'ID must be lowercase alphanumeric with hyphens',
      status: 400,
      requestId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    },
  },
});

/**
 * 404 Not Found error response schema.
 * Example: Valid ID format but entity doesn't exist.
 */
export const NotFoundErrorResponseSchema = BaseErrorSchema.openapi('NotFoundErrorResponse', {
  example: {
    error: {
      code: 'NOT_FOUND',
      message: "Vehicle 'nonexistent-vehicle' not found",
      status: 404,
      requestId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    },
  },
});

/**
 * 429 Too Many Requests. Sent by Cloudflare's edge rate limiting before the Worker runs,
 * so it is plain text (`error code: 1015`) rather than the JSON error shape above.
 */
export const rateLimitedResponse = {
  description:
    'Rate limited at the edge (per client IP). Plain-text body; wait `Retry-After` seconds before retrying.',
  headers: z.object({
    'Retry-After': z.string().openapi({
      description: 'Seconds to wait before retrying',
      example: '10',
    }),
  }),
  content: {
    'text/plain': {
      schema: z.string().openapi({ example: 'error code: 1015' }),
    },
  },
};

export type ErrorResponse = z.infer<typeof BaseErrorSchema>;

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Creates a structured error response body, attaching the request ID when available.
 */
export function errorBody(
  c: Context<AppEnv>,
  code: ErrorCode,
  message: string,
  status: number,
): ErrorResponse {
  const requestId = c.get('requestId');
  return {
    error: {
      code,
      message,
      status,
      ...(requestId && { requestId }),
    },
  };
}

/**
 * Returns a 404 Not Found error response.
 */
export function notFound(c: Context<AppEnv>, entityType: string, id: string) {
  return c.json(errorBody(c, ErrorCode.NOT_FOUND, `${entityType} '${id}' not found`, 404), 404);
}

/**
 * Returns a 404 Not Found error for unknown endpoints, listing the known ones for discoverability.
 */
export function endpointNotFound(
  c: Context<AppEnv>,
  path: string,
  availableEndpoints: string[],
): Response {
  return c.json(
    {
      ...errorBody(c, ErrorCode.NOT_FOUND, 'Endpoint not found', 404),
      path,
      availableEndpoints,
    },
    404,
  );
}
