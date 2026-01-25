import { CharactersResponseSchema, VehiclesResponseSchema, TracksResponseSchema } from './schemas';
import { DATA_VERSION } from './data-version';

import charactersData from '../data/characters.json';
import vehiclesData from '../data/vehicles.json';
import tracksData from '../data/tracks.json';

const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function formatZodIssues(issues: unknown) {
  return JSON.stringify(issues, null, 2);
}

function assertDataVersion(label: string, dataVersion: string) {
  if (dataVersion !== DATA_VERSION) {
    throw new Error(
      `Data version mismatch for ${label}: json=${dataVersion} expected=${DATA_VERSION}`,
    );
  }
}

function assertIds(label: string, ids: string[]) {
  const invalid = ids.filter((id) => !ID_PATTERN.test(id));
  if (invalid.length > 0) {
    throw new Error(`Invalid IDs in ${label}: ${invalid.join(', ')}`);
  }
}

const charactersParsed = CharactersResponseSchema.safeParse(charactersData);
if (!charactersParsed.success) {
  throw new Error(`Invalid characters data:\n${formatZodIssues(charactersParsed.error.issues)}`);
}
assertDataVersion('characters', charactersParsed.data.dataVersion);
assertIds(
  'characters',
  charactersParsed.data.characters.map((c) => c.id),
);

const vehiclesParsed = VehiclesResponseSchema.safeParse(vehiclesData);
if (!vehiclesParsed.success) {
  throw new Error(`Invalid vehicles data:\n${formatZodIssues(vehiclesParsed.error.issues)}`);
}
assertDataVersion('vehicles', vehiclesParsed.data.dataVersion);
assertIds(
  'vehicles',
  vehiclesParsed.data.vehicles.map((v) => v.id),
);
assertIds(
  'vehicle tags',
  vehiclesParsed.data.vehicles.map((v) => v.tag),
);

const tracksParsed = TracksResponseSchema.safeParse(tracksData);
if (!tracksParsed.success) {
  throw new Error(`Invalid tracks data:\n${formatZodIssues(tracksParsed.error.issues)}`);
}
assertDataVersion('tracks', tracksParsed.data.dataVersion);
assertIds(
  'tracks',
  tracksParsed.data.tracks.map((t) => t.id),
);

export const dataVersion = DATA_VERSION;
export const characters = charactersParsed.data.characters;
export const vehicles = vehiclesParsed.data.vehicles;
export const tracks = tracksParsed.data.tracks;
