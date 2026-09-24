import { describe, expect, it, vi } from 'vitest';
import type { CharactersResponse, TracksResponse, VehiclesResponse } from './schemas';

const baseCharacter = {
  id: 'test-character',
  name: 'Test Character',
  size: 'Small',
  class: 'Fly',
  speed: { road: 0, rough: 0, water: 0, gliding: 0 },
  handling: { road: 0, rough: 0, water: 0 },
  acceleration: 0,
  miniTurbo: 0,
  weight: 0,
  coinCurve: 0,
  invincibility: 0,
};

const baseVehicle = {
  id: 'test-vehicle',
  name: 'Test Vehicle',
  tag: 'test-tag',
  class: 'Test Class',
  speed: { road: 0, rough: 0, water: 0, gliding: 0 },
  handling: { road: 0, rough: 0, water: 0 },
  acceleration: 0,
  miniTurbo: 0,
  weight: 0,
  coinCurve: 0,
  invincibility: 0,
};

const baseTrack = {
  id: 'test-track',
  name: 'Test Track',
  cup: 'Test Cup',
  cupId: 'test-cup',
  surfaceCoverage: { road: 20, rough: 20, water: 20, gliding: 20, neutral: 20, offRoad: 0 },
  terrainCoverage: { road: 50, rough: 30, water: 20 },
};

const loadData = async (options: {
  moduleVersion: string;
  characters: CharactersResponse;
  vehicles: VehiclesResponse;
  tracks: TracksResponse;
}) => {
  vi.resetModules();
  vi.doMock('./data-version', () => ({ DATA_VERSION: options.moduleVersion }));
  vi.doMock('../data/characters.json', () => ({ default: options.characters }));
  vi.doMock('../data/vehicles.json', () => ({ default: options.vehicles }));
  vi.doMock('../data/tracks.json', () => ({ default: options.tracks }));
  return import('./data');
};

const validPayloads = (version: string) => ({
  moduleVersion: version,
  characters: { dataVersion: version, characters: [baseCharacter] },
  vehicles: { dataVersion: version, vehicles: [baseVehicle] },
  tracks: { dataVersion: version, tracks: [baseTrack] },
});

describe('data loading', () => {
  it('exports validated data and service-versioned ETags', async () => {
    const data = await loadData(validPayloads('test-version'));
    expect(data.dataVersion).toBe('test-version');
    expect(data.characters).toHaveLength(1);
    expect(data.etags.characters).toMatch(/^"\d+\.\d+\.\d+-[0-9a-z]+"$/);
    expect(new Set(Object.values(data.etags)).size).toBe(3);
  });

  it('changes the ETag when data changes without a dataVersion change', async () => {
    const before = await loadData(validPayloads('same-day'));
    const changed = validPayloads('same-day');
    changed.characters.characters = [{ ...baseCharacter, weight: 5 }];
    const after = await loadData(changed);
    expect(after.etags.characters).not.toBe(before.etags.characters);
    expect(after.etags.vehicles).toBe(before.etags.vehicles);
  });
});

describe('data validation', () => {
  it('throws on duplicate IDs', async () => {
    const payloads = validPayloads('test-version');
    payloads.characters.characters = [baseCharacter, baseCharacter];
    await expect(loadData(payloads)).rejects.toThrow(/Duplicate IDs in characters: test-character/);
  });

  it('throws on invalid cup IDs', async () => {
    const payloads = validPayloads('test-version');
    payloads.tracks.tracks = [{ ...baseTrack, cupId: 'Bad Cup' }];
    await expect(loadData(payloads)).rejects.toThrow(/Invalid IDs in cup IDs/);
  });

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
        vehicles: { dataVersion: 'test-version', vehicles: [{}] as VehiclesResponse['vehicles'] },
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
          characters: [{}] as CharactersResponse['characters'],
        },
        vehicles: { dataVersion: 'test-version', vehicles: [baseVehicle] },
        tracks: { dataVersion: 'test-version', tracks: [baseTrack] },
      }),
    ).rejects.toThrow(/Invalid characters data/);
  });
});
