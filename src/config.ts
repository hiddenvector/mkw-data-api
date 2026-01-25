import packageJson from '../package.json';

const API_VERSION = 'v1';

export const API_CONFIG = {
  apiVersion: API_VERSION,
  serviceVersion: packageJson.version,
  basePath: `/mkw/api/${API_VERSION}`,
} as const;
