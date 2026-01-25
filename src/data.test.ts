import { describe, it, expect, vi } from 'vitest';

const DATA_VERSION = 'test-version';

vi.mock('./data-version', () => ({ DATA_VERSION }));

vi.mock('../data/characters.json', () => ({
  default: {
    dataVersion: DATA_VERSION,
    characters: [
      {
        id: 'Bad ID',
        name: 'Test Character',
        speed: { road: 0, rough: 0, water: 0 },
        handling: { road: 0, rough: 0, water: 0 },
        acceleration: 0,
        miniTurbo: 0,
        weight: 0,
        coinCurve: 0,
      },
    ],
  },
}));

vi.mock('../data/vehicles.json', () => ({
  default: {
    dataVersion: DATA_VERSION,
    vehicles: [
      {
        id: 'test-vehicle',
        name: 'Test Vehicle',
        tag: 'test-tag',
        speed: { road: 0, rough: 0, water: 0 },
        handling: { road: 0, rough: 0, water: 0 },
        acceleration: 0,
        miniTurbo: 0,
        weight: 0,
        coinCurve: 0,
      },
    ],
  },
}));

vi.mock('../data/tracks.json', () => ({
  default: {
    dataVersion: DATA_VERSION,
    tracks: [
      {
        id: 'test-track',
        name: 'Test Track',
        cup: 'Test Cup',
        surfaceCoverage: { road: 20, rough: 20, water: 20, neutral: 20, offRoad: 20 },
        terrainCoverage: { road: 50, rough: 30, water: 20 },
      },
    ],
  },
}));

describe('data validation', () => {
  it('throws when IDs are invalid', async () => {
    await expect(import('./data')).rejects.toThrow(/Invalid IDs in characters/);
  });
});
