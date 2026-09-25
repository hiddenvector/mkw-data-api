import type { z } from '@hono/zod-openapi';
import {
  CharactersResponseSchema,
  MechanicsResponseSchema,
  RalliesResponseSchema,
  TracksResponseSchema,
  VehiclesResponseSchema,
} from './schemas';
import { API_CONFIG } from './config';
import { DATA_VERSION } from './data-version';
import { assertLevelsIndexed, assertValidIds } from './lib/validate';
import { makeEtag } from './utils';

import charactersData from '../data/characters.json';
import vehiclesData from '../data/vehicles.json';
import tracksData from '../data/tracks.json';
import ralliesData from '../data/rallies.json';
import mechanicsData from '../data/mechanics.json';

/**
 * Validates a generated data file against its response schema and the pinned DATA_VERSION.
 * Runs once at Worker startup; any failure prevents the Worker from serving bad data.
 */
function load<S extends z.ZodType<{ dataVersion: string }>>(
  label: string,
  schema: S,
  payload: unknown,
): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Invalid ${label} data:\n${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  if (parsed.data.dataVersion !== DATA_VERSION) {
    throw new Error(
      `Data version mismatch for ${label}: json=${parsed.data.dataVersion} expected=${DATA_VERSION}`,
    );
  }
  return parsed.data;
}

const charactersPayload = load('characters', CharactersResponseSchema, charactersData);
assertValidIds(
  'characters',
  charactersPayload.characters.map((c) => c.id),
);

const vehiclesPayload = load('vehicles', VehiclesResponseSchema, vehiclesData);
assertValidIds(
  'vehicles',
  vehiclesPayload.vehicles.map((v) => v.id),
);
assertValidIds(
  'vehicle tags',
  vehiclesPayload.vehicles.map((v) => v.tag),
  { unique: false },
);

const tracksPayload = load('tracks', TracksResponseSchema, tracksData);
assertValidIds(
  'tracks',
  tracksPayload.tracks.map((t) => t.id),
);
assertValidIds(
  'cup IDs',
  tracksPayload.tracks.map((t) => t.cupId),
  { unique: false },
);

const ralliesPayload = load('rallies', RalliesResponseSchema, ralliesData);
assertValidIds(
  'rallies',
  ralliesPayload.rallies.map((r) => r.id),
);

const mechanicsPayload = load('mechanics', MechanicsResponseSchema, mechanicsData);
assertLevelsIndexed(mechanicsPayload);

export const dataVersion = DATA_VERSION;
export const characters = charactersPayload.characters;
export const vehicles = vehiclesPayload.vehicles;
export const tracks = tracksPayload.tracks;
export const rallies = ralliesPayload.rallies;
export const mechanics = mechanicsPayload;

/**
 * ETags per collection: a hash of the full response body, prefixed with the service version
 * so representation changes in a code release also invalidate cached responses.
 * Item and filtered endpoints reuse their collection's ETag (any change to the collection
 * changes it, so a 304 is never stale).
 */
export const etags = {
  characters: makeEtag(API_CONFIG.serviceVersion, charactersPayload),
  vehicles: makeEtag(API_CONFIG.serviceVersion, vehiclesPayload),
  tracks: makeEtag(API_CONFIG.serviceVersion, tracksPayload),
  rallies: makeEtag(API_CONFIG.serviceVersion, ralliesPayload),
  mechanics: makeEtag(API_CONFIG.serviceVersion, mechanicsPayload),
} as const;
