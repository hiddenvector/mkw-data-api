import { OpenAPIHono } from '@hono/zod-openapi';
import { ErrorCode, errorBody } from './errors';

// Type for app-level variables stored in context
export type AppVariables = {
  requestId: string;
};

export type AppEnv = { Variables: AppVariables };

/**
 * Creates an OpenAPIHono instance with the shared validation error hook.
 */
export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const message = result.error.issues.map((issue) => issue.message).join('; ');
        return c.json(errorBody(c, ErrorCode.VALIDATION_ERROR, message, 400), 400);
      }
    },
  });
}
