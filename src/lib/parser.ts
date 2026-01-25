import type { SurfaceCoverage } from '../schemas';

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
 * Safely parse a percentage string to a number
 * @example parsePercent("47%") → 47
 * @example parsePercent("47,5%") → 47.5 (handles European decimals)
 */
export function parsePercent(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace('%', '').replace(',', '.'));
}

/**
 * Parse surface coverage from a CSV row
 */
export function parseSurfaceCoverage(row: CsvRow): SurfaceCoverage {
  return {
    road: parsePercent(row[COL.COVERAGE_ROAD]),
    rough: parsePercent(row[COL.COVERAGE_ROUGH]),
    water: parsePercent(row[COL.COVERAGE_WATER]),
    neutral: parsePercent(row[COL.COVERAGE_NEUTRAL]),
    offRoad: parsePercent(row[COL.COVERAGE_OFFROAD]),
  };
}

/**
 * Parse adjusted terrain coverage (road/rough/water only), normalized to 100%.
 */
export function parseTerrainCoverage(row: CsvRow) {
  const road = parsePercent(row[COL.ADJ_COVERAGE_ROAD]);
  const rough = parsePercent(row[COL.ADJ_COVERAGE_ROUGH]);
  const water = parsePercent(row[COL.ADJ_COVERAGE_WATER]);
  const total = road + rough + water;

  if (total === 0) {
    return { road: 0, rough: 0, water: 0 };
  }

  const scale = 100 / total;
  const round2 = (value: number) => Math.round(value * 100) / 100;

  return {
    road: round2(road * scale),
    rough: round2(rough * scale),
    water: round2(water * scale),
  };
}
