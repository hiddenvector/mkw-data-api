/**
 * Structured error handling for Mario Kart World Data API
 */

import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_ID: 'INVALID_ID',
  INVALID_TAG: 'INVALID_TAG',
  INVALID_CUP: 'INVALID_CUP',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// Error Response Schema
// ============================================================================

/**
 * Base error response schema (used internally).
 */
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

/** @deprecated Use ValidationErrorResponseSchema or NotFoundErrorResponseSchema */
export const ErrorResponseSchema = BaseErrorSchema.openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof BaseErrorSchema>;

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Creates a structured error response object.
 */
function createError(
  code: ErrorCode,
  message: string,
  status: number,
  requestId?: string,
): ErrorResponse {
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
export function notFound(c: Context, entityType: string, id: string) {
  const requestId = c.get('requestId') as string | undefined;
  const error = createError(ErrorCode.NOT_FOUND, `${entityType} '${id}' not found`, 404, requestId);
  return c.json(error, 404);
}

/**
 * Returns a 400 Bad Request error for invalid ID format.
 */
export function invalidId(c: Context, id: string) {
  const requestId = c.get('requestId') as string | undefined;
  const error = createError(
    ErrorCode.INVALID_ID,
    `Invalid ID format: '${id}'. IDs must be lowercase alphanumeric with hyphens.`,
    400,
    requestId,
  );
  return c.json(error, 400);
}

/**
 * Returns a 400 Bad Request error for invalid tag format.
 */
export function invalidTag(c: Context, tag: string) {
  const requestId = c.get('requestId') as string | undefined;
  const error = createError(
    ErrorCode.INVALID_TAG,
    `Invalid tag format: '${tag}'. Tags must be lowercase alphanumeric with hyphens.`,
    400,
    requestId,
  );
  return c.json(error, 400);
}

/**
 * Returns a 400 Bad Request error for invalid cup format.
 */
export function invalidCup(c: Context, cup: string) {
  const requestId = c.get('requestId') as string | undefined;
  const error = createError(
    ErrorCode.INVALID_CUP,
    `Invalid cup format: '${cup}'. Cup names must be lowercase with hyphens (e.g., 'mushroom-cup').`,
    400,
    requestId,
  );
  return c.json(error, 400);
}

/**
 * Returns a 400 Bad Request error for validation failures.
 */
export function validationError(c: Context, message: string) {
  const requestId = c.get('requestId') as string | undefined;
  const error = createError(ErrorCode.VALIDATION_ERROR, message, 400, requestId);
  return c.json(error, 400);
}

/**
 * Returns a 404 Not Found error for unknown endpoints.
 */
export function endpointNotFound(c: Context, path: string, availableEndpoints: string[]): Response {
  const requestId = c.get('requestId') as string | undefined;
  // Include available endpoints in the message for discoverability
  return c.json(
    {
      error: {
        code: ErrorCode.NOT_FOUND,
        message: 'Endpoint not found',
        status: 404,
        ...(requestId && { requestId }),
      },
      path,
      availableEndpoints,
    },
    404,
  );
}
