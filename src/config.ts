import packageJson from '../package.json';

const API_VERSION = 'v1';

export const API_CONFIG = {
  apiVersion: API_VERSION,
  serviceVersion: packageJson.version,
  basePath: `/mkw/api/${API_VERSION}`,
  /** Pinned Scalar bundle for /docs. Bump deliberately; the docs CSP allows only this URL. */
  scalarCdn: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.71.0',
} as const;
