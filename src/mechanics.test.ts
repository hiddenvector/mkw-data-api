import { describe, expect, it } from 'vitest';
import charactersData from '../data/characters.json';
import vehiclesData from '../data/vehicles.json';
import mechanicsData from '../data/mechanics.json';

type Combo = (typeof charactersData.characters)[number] | (typeof vehiclesData.vehicles)[number];

/** Highest level any character + vehicle combination reaches for a stat. */
const maxComboLevel = (stat: (entity: Combo) => number) =>
  Math.max(...charactersData.characters.map(stat)) + Math.max(...vehiclesData.vehicles.map(stat));

describe('mechanics tables cover every combo', () => {
  // A future import could push stats past the end of a table; clients index by level.
  it.each([
    ['speed.road', (e: Combo) => e.speed.road, mechanicsData.speed.road],
    ['speed.rough', (e: Combo) => e.speed.rough, mechanicsData.speed.rough],
    ['speed.water', (e: Combo) => e.speed.water, mechanicsData.speed.water],
    ['speed.gliding', (e: Combo) => e.speed.gliding, mechanicsData.speed.gliding],
    ['coinCurve', (e: Combo) => e.coinCurve, mechanicsData.coinCurve],
    ['acceleration', (e: Combo) => e.acceleration, mechanicsData.acceleration],
    ['miniTurbo', (e: Combo) => e.miniTurbo, mechanicsData.miniTurbo],
    ['handling.road', (e: Combo) => e.handling.road, mechanicsData.handling.road],
    ['handling.rough', (e: Combo) => e.handling.rough, mechanicsData.handling.rough],
    ['handling.water', (e: Combo) => e.handling.water, mechanicsData.handling.water],
  ])('%s', (_, stat, table) => {
    expect(table.length - 1).toBeGreaterThanOrEqual(maxComboLevel(stat));
  });
});

describe('mechanics match the Statpedia Combo Builder', () => {
  // Rosalina + Mach Rocket in the sheet's Combo Builder tab: On-Road Speed 10, Coin Curve 8
  it('reproduces its on-road speed by coin count', () => {
    const base = mechanicsData.speed.road[10].units;
    const bonus = mechanicsData.coinCurve[8].bonusPercentByCoins;
    const speedAt = (coins: number) => Math.round(base * (1 + bonus[coins] / 100) * 1000) / 1000;
    expect(speedAt(0)).toBe(103.12);
    expect(speedAt(1)).toBe(104.017);
    expect(speedAt(20)).toBe(108.276);
  });
});
