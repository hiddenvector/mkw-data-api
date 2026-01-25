import { describe, expect, it, vi } from 'vitest';

type CharactersPayload = {
  dataVersion: string;
  characters: Array<{
    id: string;
    name: string;
    speed: { road: number; rough: number; water: number };
    handling: { road: number; rough: number; water: number };
    acceleration: number;
    miniTurbo: number;
    weight: number;
    coinCurve: number;
  }>;
};

type VehiclesPayload = {
  dataVersion: string;
  vehicles: Array<{
    id: string;
    name: string;
    tag: string;
    speed: { road: number; rough: number; water: number };
    handling: { road: number; rough: number; water: number };
    acceleration: number;
    miniTurbo: number;
    weight: number;
    coinCurve: number;
  }>;
};

type TracksPayload = {
  dataVersion: string;
  tracks: Array<{
    id: string;
    name: string;
    cup: string;
    surfaceCoverage: { road: number; rough: number; water: number; neutral: number; offRoad: number };
    terrainCoverage: { road: number; rough: number; water: number };
  }>;
};

const baseCharacter = {
  id: 'test-character',
  name: 'Test Character',
  speed: { road: 0, rough: 0, water: 0 },
  handling: { road: 0, rough: 0, water: 0 },
  acceleration: 0,
  miniTurbo: 0,
  weight: 0,
  coinCurve: 0,
};

const baseVehicle = {
  id: 'test-vehicle',
  name: 'Test Vehicle',
  tag: 'test-tag',
  speed: { road: 0, rough: 0, water: 0 },
  handling: { road: 0, rough: 0, water: 0 },
  acceleration: 0,
  miniTurbo: 0,
  weight: 0,
  coinCurve: 0,
};

const baseTrack = {
  id: 'test-track',
  name: 'Test Track',
  cup: 'Test Cup',
  surfaceCoverage: { road: 20, rough: 20, water: 20, neutral: 20, offRoad: 20 },
  terrainCoverage: { road: 50, rough: 30, water: 20 },
};

const loadData = async (options: {
  moduleVersion: string;
  characters: CharactersPayload;
  vehicles: VehiclesPayload;
  tracks: TracksPayload;
}) => {
  vi.resetModules();
  vi.doMock('./data-version', () => ({ DATA_VERSION: options.moduleVersion }));
  vi.doMock('../data/characters.json', () => ({ default: options.characters }));
  vi.doMock('../data/vehicles.json', () => ({ default: options.vehicles }));
  vi.doMock('../data/tracks.json', () => ({ default: options.tracks }));
  return import('./data');
};

describe('data validation', () => {
  it('throws when IDs are invalid', async () => {
    await expect(
      loadData({
        moduleVersion: 'test-version',
        characters: {
          dataVersion: 'test-version',
          characters: [{ ...baseCharacter, id: 'Bad ID' }],
        },
        vehicles: { dataVersion: 'test-version', vehicles: [baseVehicle] },
        tracks: { dataVersion: 'test-version', tracks: [baseTrack] },
      }),
    ).rejects.toThrow(/Invalid IDs in characters/);
  });

  it('throws when dataVersion mismatches', async () => {
    await expect(
      loadData({
        moduleVersion: 'expected-version',
        characters: { dataVersion: 'wrong-version', characters: [baseCharacter] },
        vehicles: { dataVersion: 'expected-version', vehicles: [baseVehicle] },
        tracks: { dataVersion: 'expected-version', tracks: [baseTrack] },
      }),
    ).rejects.toThrow(/Data version mismatch for characters/);
  });

  it('throws when tracks dataVersion mismatches', async () => {
    await expect(
      loadData({
        moduleVersion: 'expected-version',
        characters: { dataVersion: 'expected-version', characters: [baseCharacter] },
        vehicles: { dataVersion: 'expected-version', vehicles: [baseVehicle] },
        tracks: { dataVersion: 'wrong-version', tracks: [baseTrack] },
      }),
    ).rejects.toThrow(/Data version mismatch for tracks/);
  });

  it('throws on invalid vehicle tags', async () => {
    await expect(
      loadData({
        moduleVersion: 'test-version',
        characters: { dataVersion: 'test-version', characters: [baseCharacter] },
        vehicles: { dataVersion: 'test-version', vehicles: [{ ...baseVehicle, tag: 'Bad Tag' }] },
        tracks: { dataVersion: 'test-version', tracks: [baseTrack] },
      }),
    ).rejects.toThrow(/Invalid IDs in vehicle tags/);
  });

  it('throws on invalid vehicles payload shape', async () => {
    await expect(
      loadData({
        moduleVersion: 'test-version',
        characters: { dataVersion: 'test-version', characters: [baseCharacter] },
        vehicles: { dataVersion: 'test-version', vehicles: [{}] as VehiclesPayload['vehicles'] },
        tracks: { dataVersion: 'test-version', tracks: [baseTrack] },
      }),
    ).rejects.toThrow(/Invalid vehicles data/);
  });

  it('throws on malformed tracks payload', async () => {
    await expect(
      loadData({
        moduleVersion: 'test-version',
        characters: { dataVersion: 'test-version', characters: [baseCharacter] },
        vehicles: { dataVersion: 'test-version', vehicles: [baseVehicle] },
        tracks: {
          dataVersion: 'test-version',
          tracks: [{ ...baseTrack, terrainCoverage: { road: 10, rough: 10, water: 200 } }],
        },
      }),
    ).rejects.toThrow(/Invalid tracks data/);
  });

  it('throws on invalid characters payload shape', async () => {
    await expect(
      loadData({
        moduleVersion: 'test-version',
        characters: {
          dataVersion: 'test-version',
          characters: [{}] as CharactersPayload['characters'],
        },
        vehicles: { dataVersion: 'test-version', vehicles: [baseVehicle] },
        tracks: { dataVersion: 'test-version', tracks: [baseTrack] },
      }),
    ).rejects.toThrow(/Invalid characters data/);
  });
});
