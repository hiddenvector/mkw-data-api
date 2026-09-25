import type { SurfaceCoverage, TerrainCoverage } from '../schemas';

export type CsvRow = string[];

export const COL = {
  // Characters: frame size and weight class; vehicles: vehicle class and tag
  SIZE: 1,
  CLASS: 2,
  VEHICLE_CLASS: 1,
  TAG: 2,

  // Shared name columns (on the row after each stat row)
  NAME_1: 3,
  NAME_2: 4,
  NAME_3: 5,
  NAME_4: 6,

  // Stat columns (same for characters and vehicles)
  SPEED_ROAD: 7,
  SPEED_ROUGH: 8,
  SPEED_WATER: 9,
  SPEED_GLIDING: 10,
  ACCELERATION: 11,
  MINI_TURBO: 12,
  WEIGHT: 13,
  COIN_CURVE: 14,
  HANDLING_ROAD: 15,
  HANDLING_ROUGH: 16,
  HANDLING_WATER: 17,
  INVINCIBILITY: 18,

  // Surface coverage columns
  SECTION: 1,
  TRACK_NAME: 2,
  TRACK_TIME: 4,
  COVERAGE_ROAD: 5,
  COVERAGE_ROUGH: 6,
  COVERAGE_WATER: 7,
  COVERAGE_GLIDING: 8,
  COVERAGE_NEUTRAL: 9,
} as const;

/**
 * Header labels the parsers rely on, by column. Checked before parsing so that a
 * reshuffled Statpedia layout fails loudly instead of silently mis-mapping stats.
 */
export const EXPECTED_HEADERS = {
  /** Second header row of the Characters and Vehicles tabs */
  stats: {
    [COL.SPEED_ROAD]: 'On-Road',
    [COL.SPEED_ROUGH]: 'Off-Road',
    [COL.SPEED_WATER]: 'Water',
    [COL.SPEED_GLIDING]: 'Gliding',
    [COL.HANDLING_ROAD]: 'On-Road Handling',
    [COL.HANDLING_ROUGH]: 'Off-Road Handling',
    [COL.HANDLING_WATER]: 'Water Handling',
  },
  /** First header row of the Characters and Vehicles tabs */
  statGroups: {
    [COL.SPEED_ROAD]: 'Speed',
    [COL.ACCELERATION]: 'Acceleration',
    [COL.MINI_TURBO]: 'Mini-Turbo',
    [COL.WEIGHT]: 'Weight',
    [COL.COIN_CURVE]: 'Coin Curve',
    [COL.HANDLING_ROAD]: 'Handling',
    [COL.INVINCIBILITY]: 'Invincibility',
  },
  /** Section header row of the Surface Coverage tab */
  coverage: {
    [COL.TRACK_TIME]: 'Time (s)',
    [COL.COVERAGE_ROAD]: 'On-Road',
    [COL.COVERAGE_ROUGH]: 'Off-Road',
    [COL.COVERAGE_WATER]: 'Water',
    [COL.COVERAGE_GLIDING]: 'Gliding',
    [COL.COVERAGE_NEUTRAL]: 'Neutral',
  },
} as const;

/** Collapses whitespace (including the line breaks some Statpedia cells contain). */
export const cleanCell = (value: string | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

/**
 * True if the row has the expected label in every listed column.
 */
export function matchesHeader(row: CsvRow, expected: Record<number, string>): boolean {
  return Object.entries(expected).every(([col, label]) => cleanCell(row[Number(col)]) === label);
}

/**
 * Throws unless some row in the sheet matches the expected header labels.
 */
export function assertHeader(rows: CsvRow[], expected: Record<number, string>, sheet: string) {
  if (!rows.some((row) => matchesHeader(row, expected))) {
    const wanted = Object.entries(expected)
      .map(([col, label]) => `col ${Number(col) + 1}="${label}"`)
      .join(', ');
    throw new Error(
      `${sheet}: header row not found (expected ${wanted}). The Statpedia layout changed; update COL in src/lib/parser.ts.`,
    );
  }
}

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
 * Parse surface coverage from a CSV row. `offRoad` is kept for /v1 compatibility and is
 * always 0: the Statpedia now counts heavy off-road as neutral.
 */
export function parseSurfaceCoverage(row: CsvRow): SurfaceCoverage {
  return {
    road: parsePercent(row[COL.COVERAGE_ROAD], 'road coverage'),
    rough: parsePercent(row[COL.COVERAGE_ROUGH], 'off-road coverage'),
    water: parsePercent(row[COL.COVERAGE_WATER], 'water coverage'),
    gliding: parsePercent(row[COL.COVERAGE_GLIDING], 'gliding coverage'),
    neutral: parsePercent(row[COL.COVERAGE_NEUTRAL], 'neutral coverage'),
    offRoad: 0,
  };
}

/** 100% expressed in hundredths of a percent (terrainCoverage has 2 decimal places). */
const TOTAL_HUNDREDTHS = 10_000;

/**
 * Road/rough/water coverage rescaled to 100%, excluding gliding and neutral.
 *
 * Uses largest-remainder rounding in hundredths of a percent so the three values
 * always sum to exactly 100 (plain rounding can produce 99.99 or 100.01).
 */
export function computeTerrainCoverage(
  surface: Pick<SurfaceCoverage, 'road' | 'rough' | 'water'>,
): TerrainCoverage {
  const values = [surface.road, surface.rough, surface.water];
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

/**
 * Parse a decimal cell that may use a comma as the decimal separator ("100,312" → 100.312)
 * and may carry a percent sign. Blank cells return null; anything else non-numeric throws.
 */
export function parseDecimal(value: string | undefined, label = 'number'): number | null {
  const cleaned = (value ?? '').replace(/%/g, '').replace(/,/g, '.').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid ${label} in CSV: '${value}'`);
  }
  return n;
}

/** Like parseDecimal, but the cell must not be blank. */
export function requireDecimal(value: string | undefined, label = 'number'): number {
  const n = parseDecimal(value, label);
  if (n === null) throw new Error(`Missing ${label} in CSV`);
  return n;
}

/**
 * Find a per-level table: the row matching `header`, then the consecutive rows after it
 * whose level column holds 0, 1, 2, … (sub-header rows in between are skipped).
 * Throws if the header is missing or the levels don't start at 0 and count up by one.
 */
export function readLevelTable(
  rows: CsvRow[],
  header: Record<number, string>,
  sheet: string,
  levelCol = 1,
): CsvRow[] {
  assertHeader(rows, header, sheet);
  const start = rows.findIndex((row) => matchesHeader(row, header));

  const table: CsvRow[] = [];
  for (const row of rows.slice(start + 1)) {
    const level = cleanCell(row[levelCol]);
    if (!/^\d+$/.test(level)) {
      if (table.length > 0) break; // end of table
      continue; // sub-header rows before the first level
    }
    if (Number(level) !== table.length) {
      throw new Error(`${sheet}: expected level ${table.length}, found level ${level}`);
    }
    table.push(row);
  }

  if (table.length === 0) throw new Error(`${sheet}: no level rows after the header`);
  return table;
}
