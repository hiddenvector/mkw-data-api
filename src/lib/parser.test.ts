import { describe, expect, it } from 'vitest';
import {
  assertHeader,
  cleanCell,
  COL,
  computeTerrainCoverage,
  EXPECTED_HEADERS,
  matchesHeader,
  normalizeDisplayName,
  parseDecimal,
  parsePercent,
  readLevelTable,
  requireDecimal,
  parseSurfaceCoverage,
  toId,
} from './parser';
import { assertLevelsIndexed, assertValidIds } from './validate';

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
    expect(parsePercent(' 0% ')).toBe(0);
  });

  it('rejects empty or non-numeric percent cells', () => {
    expect(() => parsePercent(undefined)).toThrow(/Invalid percentage/);
    expect(() => parsePercent('')).toThrow(/Invalid percentage/);
    expect(() => parsePercent('N/A', 'road coverage')).toThrow(
      "Invalid road coverage in CSV: 'N/A'",
    );
  });

  it('parses surface coverage, with deprecated offRoad always 0', () => {
    const row: string[] = [];
    row[COL.COVERAGE_ROAD] = '47%';
    row[COL.COVERAGE_ROUGH] = '15%';
    row[COL.COVERAGE_WATER] = '0%';
    row[COL.COVERAGE_GLIDING] = '6%';
    row[COL.COVERAGE_NEUTRAL] = '32%';
    expect(parseSurfaceCoverage(row)).toEqual({
      road: 47,
      rough: 15,
      water: 0,
      gliding: 6,
      neutral: 32,
      offRoad: 0,
    });
  });

  it('rescales road/rough/water to 100, ignoring gliding and neutral', () => {
    expect(computeTerrainCoverage({ road: 47, rough: 15, water: 0 })).toEqual({
      road: 75.81,
      rough: 24.19,
      water: 0,
    });
  });

  it('rounds terrain coverage so it sums to exactly 100', () => {
    const coverage = computeTerrainCoverage({ road: 1, rough: 1, water: 1 });
    expect(coverage).toEqual({ road: 33.34, rough: 33.33, water: 33.33 });
    const hundredths = [coverage.road, coverage.rough, coverage.water].map((v) =>
      Math.round(v * 100),
    );
    expect(hundredths.reduce((a, b) => a + b)).toBe(10_000);
  });

  it('handles zero terrain coverage safely', () => {
    expect(computeTerrainCoverage({ road: 0, rough: 0, water: 0 })).toEqual({
      road: 0,
      rough: 0,
      water: 0,
    });
  });

  it('collapses whitespace in cells', () => {
    expect(cleanCell(' Off-Road\nHybrid ')).toBe('Off-Road Hybrid');
    expect(cleanCell(undefined)).toBe('');
  });
});

describe('header checks', () => {
  const headerRow = (labels: Record<number, string>) => {
    const row: string[] = [];
    for (const [col, label] of Object.entries(labels)) row[Number(col)] = label;
    return row;
  };

  it('matches rows with the expected labels, ignoring line breaks', () => {
    const row = headerRow(EXPECTED_HEADERS.stats);
    row[COL.HANDLING_ROAD] = 'On-Road\nHandling';
    expect(matchesHeader(row, EXPECTED_HEADERS.stats)).toBe(true);
  });

  it('passes when some row matches', () => {
    const rows = [[], headerRow(EXPECTED_HEADERS.coverage)];
    expect(() => assertHeader(rows, EXPECTED_HEADERS.coverage, 'Sheet')).not.toThrow();
  });

  it('fails loudly when columns have moved', () => {
    const shifted = [['', ...headerRow(EXPECTED_HEADERS.stats)]];
    expect(() => assertHeader(shifted, EXPECTED_HEADERS.stats, 'Characters')).toThrow(
      /Characters: header row not found .*col 8="On-Road".*layout changed/,
    );
  });
});

describe('assertValidIds', () => {
  it('accepts valid unique slugs', () => {
    expect(() => assertValidIds('things', ['a', 'b-2'])).not.toThrow();
  });

  it('rejects malformed slugs', () => {
    expect(() => assertValidIds('things', ['ok', 'Not-Ok', '-x'])).toThrow(
      "Invalid IDs in things: 'Not-Ok', '-x'",
    );
  });

  it('rejects duplicates unless disabled', () => {
    expect(() => assertValidIds('things', ['a', 'a', 'b', 'b', 'b'])).toThrow(
      'Duplicate IDs in things: a, b',
    );
    expect(() => assertValidIds('tags', ['a', 'a'], { unique: false })).not.toThrow();
  });
});

describe('decimal cells', () => {
  it('parses comma decimals and percents; blanks are null', () => {
    expect(parseDecimal('100,312')).toBe(100.312);
    expect(parseDecimal('0,490%')).toBe(0.49);
    expect(parseDecimal(' ')).toBeNull();
    expect(() => parseDecimal('N/A', 'speed')).toThrow("Invalid speed in CSV: 'N/A'");
    expect(() => requireDecimal('', 'speed')).toThrow('Missing speed in CSV');
  });
});

describe('readLevelTable', () => {
  const header = { 1: 'Lv.', 2: 'Value' };
  const rows = [
    ['', 'Title'],
    ['', 'Lv.', 'Value'],
    ['', '', 'units'],
    ['', '0', '1,5'],
    ['', '1', '2,5'],
    ['', 'Note'],
    ['', '5', 'ignored'],
  ];

  it('returns consecutive level rows after the header, skipping sub-headers', () => {
    expect(readLevelTable(rows, header, 'Sheet').map((r) => r[2])).toEqual(['1,5', '2,5']);
  });

  it('rejects gaps in levels', () => {
    const gappy = [
      ['', 'Lv.', 'Value'],
      ['', '0', 'a'],
      ['', '2', 'b'],
    ];
    expect(() => readLevelTable(gappy, header, 'Sheet')).toThrow(
      'Sheet: expected level 1, found level 2',
    );
  });

  it('fails when the header is missing', () => {
    expect(() => readLevelTable([['', 'Level', 'Value']], header, 'Sheet')).toThrow(
      /Sheet: header row not found/,
    );
  });
});

describe('assertLevelsIndexed', () => {
  it('accepts nested level arrays indexed by position', () => {
    expect(() =>
      assertLevelsIndexed({ a: [{ level: 0 }, { level: 1 }], b: { c: [{ level: 0 }] } }),
    ).not.toThrow();
  });

  it('names the first misplaced level', () => {
    expect(() => assertLevelsIndexed({ b: { c: [{ level: 0 }, { level: 2 }] } })).toThrow(
      'mechanics.b.c[1]: level 2 is not at index 1',
    );
  });
});
