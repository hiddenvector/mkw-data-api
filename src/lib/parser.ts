import type { SurfaceCoverage, TerrainCoverage } from '../schemas';

export type CsvRow = string[];

export const COL = {
  // Shared name columns
  NAME_1: 3,
  NAME_2: 4,
  NAME_3: 5,
  NAME_4: 6,

  // Stat columns (same for characters and vehicles)
  SPEED_ROAD: 7,
  SPEED_ROUGH: 8,
  SPEED_WATER: 9,
  ACCELERATION: 10,
  MINI_TURBO: 11,
  WEIGHT: 12,
  COIN_CURVE: 13,
  HANDLING_ROAD: 14,
  HANDLING_ROUGH: 15,
  HANDLING_WATER: 16,

  // Vehicle-specific columns
  CLASS: 1,
  TAG: 2,

  // Track columns
  TRACK_NAME: 1,
  TRACK_TIME: 2,
  COVERAGE_ROAD: 3,
  COVERAGE_ROUGH: 4,
  COVERAGE_WATER: 5,
  COVERAGE_NEUTRAL: 6,
  COVERAGE_OFFROAD: 7,
  ADJ_COVERAGE_ROAD: 8,
  ADJ_COVERAGE_ROUGH: 9,
  ADJ_COVERAGE_WATER: 10,
  ADJ_COVERAGE_NEUTRAL: 11,
  ADJ_COVERAGE_OFFROAD: 12,
} as const;

/**
 * Convert a name to a URL-safe ID (slug)
 * @example toId("Baby Peach") → "baby-peach"
 * @example toId("R.O.B. H.O.G.") → "rob-hog"
 */
export function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\?/g, ' question ')
    .replace(/\s+/g, '-') // spaces → hyphens
    .replace(/\./g, '') // remove periods
    .replace(/'/g, '') // remove apostrophes
    .replace(/_/g, '-') // underscores → hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

/**
 * Normalize Statpedia names to US-standard display names.
 * Keep this list tiny and well-documented to avoid drifting from source data.
 */
export function normalizeDisplayName(name: string): string {
  switch (name) {
    case 'Swooper':
      return 'Swoop';
    case 'Fishbone':
      return 'Fish Bone';
    default:
      return name;
  }
}

/**
 * Parse a percentage cell. Empty or non-numeric cells are an error: silently
 * treating missing data as 0% would ship wrong coverage numbers.
 * @example parsePercent("47%") → 47
 * @example parsePercent("47,5%") → 47.5 (handles European decimals)
 * @throws {Error} If the cell is empty or not a number
 */
export function parsePercent(value: string | undefined, label = 'percentage'): number {
  const cleaned = (value ?? '').replace(/%/g, '').replace(/,/g, '.').trim();
  const n = cleaned === '' ? NaN : Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid ${label} in CSV: '${value ?? ''}'`);
  }
  return n;
}

/**
 * Parse surface coverage from a CSV row
 */
export function parseSurfaceCoverage(row: CsvRow): SurfaceCoverage {
  return {
    road: parsePercent(row[COL.COVERAGE_ROAD], 'road coverage'),
    rough: parsePercent(row[COL.COVERAGE_ROUGH], 'rough coverage'),
    water: parsePercent(row[COL.COVERAGE_WATER], 'water coverage'),
    neutral: parsePercent(row[COL.COVERAGE_NEUTRAL], 'neutral coverage'),
    offRoad: parsePercent(row[COL.COVERAGE_OFFROAD], 'off-road coverage'),
  };
}

/** 100% expressed in hundredths of a percent (terrainCoverage has 2 decimal places). */
const TOTAL_HUNDREDTHS = 10_000;

/**
 * Parse adjusted terrain coverage (road/rough/water only), normalized to 100%.
 *
 * Uses largest-remainder rounding in hundredths of a percent so the three values
 * always sum to exactly 100 (plain rounding can produce 99.99 or 100.01).
 */
export function parseTerrainCoverage(row: CsvRow): TerrainCoverage {
  const values = [
    parsePercent(row[COL.ADJ_COVERAGE_ROAD], 'adjusted road coverage'),
    parsePercent(row[COL.ADJ_COVERAGE_ROUGH], 'adjusted rough coverage'),
    parsePercent(row[COL.ADJ_COVERAGE_WATER], 'adjusted water coverage'),
  ];
  const total = values.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return { road: 0, rough: 0, water: 0 };
  }

  const exact = values.map((v) => (v * TOTAL_HUNDREDTHS) / total);
  const rounded = exact.map(Math.floor);
  let remainder = TOTAL_HUNDREDTHS - rounded.reduce((a, b) => a + b, 0);

  // Hand out the leftover hundredths to the values that lost the most to flooring
  const byFraction = exact
    .map((v, i) => ({ i, fraction: v - rounded[i] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    rounded[i] += 1;
    remainder -= 1;
  }

  const [road, rough, water] = rounded.map((h) => h / 100);
  return { road, rough, water };
}
