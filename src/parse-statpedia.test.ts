import { describe, expect, it } from 'vitest';
import { normalizeDisplayName, parsePercent, parseSurfaceCoverage, parseTerrainCoverage, toId } from '../scripts/parse-statpedia';

describe('parse-statpedia helpers', () => {
  it('normalizes US display names', () => {
    expect(normalizeDisplayName('Swooper')).toBe('Swoop');
    expect(normalizeDisplayName('Fishbone')).toBe('Fish Bone');
    expect(normalizeDisplayName('Dry Bones')).toBe('Dry Bones');
  });

  it('slugifies names consistently', () => {
    expect(toId('R.O.B. H.O.G.')).toBe('rob-hog');
    expect(toId("Toad's Factory")).toBe('toads-factory');
    expect(toId('Great ? Block Ruins')).toBe('great-question-block-ruins');
  });

  it('parses percent values with EU decimals', () => {
    expect(parsePercent('47%')).toBe(47);
    expect(parsePercent('47,5%')).toBe(47.5);
    expect(parsePercent(undefined)).toBe(0);
  });

  it('parses surface coverage', () => {
    const row = [''] as string[];
    row[3] = '47%';
    row[4] = '15%';
    row[5] = '0%';
    row[6] = '34%';
    row[7] = '4%';
    const coverage = parseSurfaceCoverage(row);
    expect(coverage).toEqual({ road: 47, rough: 15, water: 0, neutral: 34, offRoad: 4 });
  });

  it('normalizes terrain coverage to 100', () => {
    const row = [''] as string[];
    row[8] = '76%';
    row[9] = '24%';
    row[10] = '0%';
    const coverage = parseTerrainCoverage(row);
    expect(coverage).toEqual({ road: 76, rough: 24, water: 0 });
  });

  it('handles zero terrain coverage safely', () => {
    const row = [''] as string[];
    row[8] = '0%';
    row[9] = '0%';
    row[10] = '0%';
    const coverage = parseTerrainCoverage(row);
    expect(coverage).toEqual({ road: 0, rough: 0, water: 0 });
  });
});
