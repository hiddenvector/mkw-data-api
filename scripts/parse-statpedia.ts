#!/usr/bin/env tsx
/**
 * Statpedia CSV Parser
 *
 * Parses Mario Kart World Statpedia CSVs into JSON format for the API.
 * Handles the complex multi-character-per-stat-line structure.
 *
 * Usage: npm run generate-data
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'csv-parse/sync';
import {
  CharactersResponseSchema,
  MechanicsResponseSchema,
  RalliesResponseSchema,
  TracksResponseSchema,
  VehiclesResponseSchema,
  type BaseStats,
  type Character,
  type MechanicsResponse,
  type Rally,
  type Track,
  type Vehicle,
} from '../src/schemas';
import { assertLevelsIndexed, assertValidIds } from '../src/lib/validate';
import {
  assertHeader,
  cleanCell,
  COL,
  computeTerrainCoverage,
  type CsvRow,
  EXPECTED_HEADERS,
  matchesHeader,
  normalizeDisplayName,
  parseDecimal,
  parseSurfaceCoverage,
  readLevelTable,
  requireDecimal,
  toId,
} from '../src/lib/parser';

// ============================================================================
// Constants
// ============================================================================

/**
 * Version to stamp on data that actually changed. Unchanged output keeps its existing
 * version, so re-running the generator is idempotent (CI relies on this).
 */
const NEW_DATA_VERSION = process.env.DATA_VERSION ?? new Date().toISOString().split('T')[0];

/** Cup assignments for tracks */
const CUP_MAPPING: Record<string, string> = {
  // Mushroom Cup
  'Mario Bros. Circuit': 'Mushroom Cup',
  'Crown City': 'Mushroom Cup',
  'Whistlestop Summit': 'Mushroom Cup',
  'DK Spaceport': 'Mushroom Cup',

  // Flower Cup
  'Desert Hills': 'Flower Cup',
  'Shy Guy Bazaar': 'Flower Cup',
  'Wario Stadium': 'Flower Cup',
  'Airship Fortress': 'Flower Cup',

  // Star Cup
  'DK Pass': 'Star Cup',
  'Starview Peak': 'Star Cup',
  'Sky-High Sundae': 'Star Cup',
  'Wario Shipyard': 'Star Cup',

  // Shell Cup
  'Koopa Troopa Beach': 'Shell Cup',
  'Faraway Oasis': 'Shell Cup',
  'Crown City 2': 'Shell Cup',
  'Peach Stadium': 'Shell Cup',

  // Banana Cup
  'Peach Beach': 'Banana Cup',
  'Salty Salty Speedway': 'Banana Cup',
  'Dino Dino Jungle': 'Banana Cup',
  'Great ? Block Ruins': 'Banana Cup',

  // Leaf Cup
  'Cheep Cheep Falls': 'Leaf Cup',
  'Dandelion Depths': 'Leaf Cup',
  'Boo Cinema': 'Leaf Cup',
  'Dry Bones Burnout': 'Leaf Cup',

  // Lightning Cup
  'Moo Moo Meadows': 'Lightning Cup',
  'Choco Mountain': 'Lightning Cup',
  "Toad's Factory": 'Lightning Cup',
  "Bowser's Castle": 'Lightning Cup',

  // Special Cup
  'Acorn Heights': 'Special Cup',
  'Mario Circuit': 'Special Cup',
  'Peach Stadium 2': 'Special Cup',
  'Rainbow Road': 'Special Cup',
};

// ============================================================================
// Utility Functions
// ============================================================================

const readCsv = (csvPath: string): CsvRow[] =>
  parse(fs.readFileSync(csvPath, 'utf-8'), { relax_column_count: true });

/**
 * Safely parse an integer from a CSV cell with detailed error context
 * @throws {Error} If value is not a valid integer
 */
function safeParseInt(
  value: string | undefined,
  context?: { row?: number; col?: number; rowData?: CsvRow },
): number {
  const trimmed = (value ?? '').trim();
  const n = trimmed === '' ? NaN : Number(trimmed);
  if (!Number.isInteger(n)) {
    let msg = `Invalid integer in CSV: '${value}'`;
    if (context?.row !== undefined && context?.col !== undefined) {
      msg += ` (row ${context.row + 1}, col ${context.col + 1})`;
    }
    if (context?.rowData) {
      msg += `\nRow: ${JSON.stringify(context.rowData.slice(0, 10))}...`;
    }
    throw new Error(msg);
  }
  return n;
}

/**
 * Check if a CSV row contains stat data (an integer at startCol)
 */
function hasStats(row: CsvRow, startCol: number): boolean {
  return /^\d+$/.test((row[startCol] ?? '').trim());
}

/**
 * Extract names from a CSV row (columns 3-6)
 */
function extractNames(row: CsvRow): string[] {
  return [row[COL.NAME_1], row[COL.NAME_2], row[COL.NAME_3], row[COL.NAME_4]]
    .map(cleanCell)
    .filter(Boolean);
}

// ============================================================================
// Stat Parsing
// ============================================================================

/**
 * Parse BaseStats from a CSV row (shared by characters and vehicles)
 */
function parseStats(row: CsvRow, rowIndex: number): BaseStats {
  const int = (col: number) => safeParseInt(row[col], { row: rowIndex, col, rowData: row });

  return {
    speed: {
      road: int(COL.SPEED_ROAD),
      rough: int(COL.SPEED_ROUGH),
      water: int(COL.SPEED_WATER),
      gliding: int(COL.SPEED_GLIDING),
    },
    handling: {
      road: int(COL.HANDLING_ROAD),
      rough: int(COL.HANDLING_ROUGH),
      water: int(COL.HANDLING_WATER),
    },
    acceleration: int(COL.ACCELERATION),
    miniTurbo: int(COL.MINI_TURBO),
    weight: int(COL.WEIGHT),
    coinCurve: int(COL.COIN_CURVE),
    invincibility: int(COL.INVINCIBILITY),
  };
}

type StatLine = {
  /** Label cells for the line; blank cells inherit the previous line's value */
  labels: Record<number, string>;
  stats: BaseStats;
  names: string[];
  /** The stat row itself, for per-line cells that must not be inherited */
  row: CsvRow;
  rowIndex: number;
};

/**
 * Parse a Characters/Vehicles style sheet.
 *
 * Structure:
 * - Two header rows (stat groups, then per-surface labels), checked before parsing
 * - Row N: label columns (size/class or class/tag), stats in columns 7-18
 * - Row N+1: names in columns 3-6 (several names can share one stat line)
 * - Label cells are only filled when they change, so blanks carry forward
 */
function parseStatSheet(csvPath: string, sheet: string, labelCols: number[]): StatLine[] {
  const rows = readCsv(csvPath);
  assertHeader(rows, EXPECTED_HEADERS.statGroups, sheet);
  assertHeader(rows, EXPECTED_HEADERS.stats, sheet);

  const lines: StatLine[] = [];
  const current: Record<number, string> = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!hasStats(row, COL.SPEED_ROAD)) continue;

    for (const col of labelCols) {
      const value = cleanCell(row[col]);
      if (value) current[col] = value;
      if (!current[col]) {
        throw new Error(`${sheet} row ${i + 1}: no value in column ${col + 1} to inherit`);
      }
    }

    const names = extractNames(rows[i + 1] ?? []);
    if (names.length === 0) {
      throw new Error(`${sheet} row ${i + 1}: stat row has no names on the following row`);
    }

    lines.push({ labels: { ...current }, stats: parseStats(row, i), names, row, rowIndex: i });
  }

  return lines;
}

// ============================================================================
// Validation
// ============================================================================

/** Allowed drift from 100% in raw surface coverage (source data is hand-estimated). */
const SURFACE_COVERAGE_TOLERANCE = 5;

/**
 * Validate a track's source-specific invariants. Shape and ranges are checked
 * later against the same Zod schemas the Worker uses.
 */
function validateTrack(track: Track): void {
  if (!CUP_MAPPING[track.name]) {
    throw new Error(`Track '${track.name}': not in CUP_MAPPING (new track? add it)`);
  }

  assertCoverageSum(`Track '${track.name}'`, track.surfaceCoverage);
}

// ============================================================================
// CSV Parsers
// ============================================================================

function parseCharacters(csvPath: string): Character[] {
  return parseStatSheet(csvPath, 'Characters', [COL.SIZE, COL.CLASS]).flatMap(
    ({ labels, stats, names }) =>
      names.map((name) => {
        const displayName = normalizeDisplayName(name);
        return {
          id: toId(displayName),
          name: displayName,
          size: labels[COL.SIZE],
          class: labels[COL.CLASS],
          ...stats,
        };
      }),
  );
}

function parseVehicles(csvPath: string): Vehicle[] {
  return parseStatSheet(csvPath, 'Vehicles', [COL.VEHICLE_CLASS]).flatMap(
    ({ labels, stats, names, row, rowIndex }) => {
      // Tags identify a stat line, so unlike classes they are never inherited
      const tag = cleanCell(row[COL.TAG]).toLowerCase();
      if (!tag) {
        throw new Error(`Vehicles row ${rowIndex + 1}: stat row has no tag`);
      }
      return names.map((name) => ({
        id: toId(name),
        name,
        tag,
        class: labels[COL.VEHICLE_CLASS],
        ...stats,
      }));
    },
  );
}
/** Section headings in the Surface Coverage tab (column 1) */
const SECTIONS = {
  tracks: 'Main Track',
  // SNES legacy tracks ("Legacy Track"): no cup data yet, so not imported
  rallies: 'Rally',
} as const;
const KNOWN_SECTIONS = new Set(['Main Track', 'Legacy Track', 'Rally']);

/** Column-1 labels that end a section */
const SECTION_END = new Set(['Average', 'Weighted Average', 'Total']);

/** Placeholder rows for rallies that haven't been released */
const UNRELEASED = 'Not released yet';

/**
 * Read one section of the Surface Coverage CSV as (name, row) pairs.
 *
 * Structure:
 * - Sections start with a heading row ("Main Track", "Legacy Track", "Rally" in column 1)
 *   that is also the column header row, and end with "Average" summary rows
 * - Course name in column 2, coverage percentages in columns 5-9
 */
function readCoverageSection(csvPath: string, wanted: string): { name: string; row: CsvRow }[] {
  const rows = readCsv(csvPath);
  assertHeader(rows, { [COL.SECTION]: wanted, ...EXPECTED_HEADERS.coverage }, 'Surface Coverage');

  const entries: { name: string; row: CsvRow }[] = [];
  let section: string | null = null;

  for (const row of rows) {
    const heading = cleanCell(row[COL.SECTION]);
    if (KNOWN_SECTIONS.has(heading)) {
      if (!matchesHeader(row, EXPECTED_HEADERS.coverage)) {
        throw new Error(`Surface Coverage: unexpected column headers in '${heading}' section`);
      }
      section = heading;
      continue;
    }
    if (SECTION_END.has(heading)) {
      section = null;
      continue;
    }

    const name = cleanCell(row[COL.TRACK_NAME]);
    if (section === wanted && name) entries.push({ name, row });
  }

  return entries;
}

function assertCoverageSum(label: string, coverage: Record<string, number>): void {
  const total = Object.values(coverage).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > SURFACE_COVERAGE_TOLERANCE) {
    throw new Error(
      `${label}: surface coverage sums to ${total.toFixed(1)}% (expected 100 ± ${SURFACE_COVERAGE_TOLERANCE})`,
    );
  }
}

function parseTracks(csvPath: string): Track[] {
  return readCoverageSection(csvPath, SECTIONS.tracks).map(({ name, row }) => {
    const cup = CUP_MAPPING[name] ?? '';
    const surfaceCoverage = parseSurfaceCoverage(row);
    const track: Track = {
      id: toId(name),
      name,
      cup,
      cupId: toId(cup),
      surfaceCoverage,
      terrainCoverage: computeTerrainCoverage(surfaceCoverage),
    };
    validateTrack(track);
    return track;
  });
}

function parseRallies(csvPath: string): Rally[] {
  return readCoverageSection(csvPath, SECTIONS.rallies)
    .filter(({ name }) => name !== UNRELEASED)
    .map(({ name, row }) => {
      const { offRoad: _deprecated, ...surfaceCoverage } = parseSurfaceCoverage(row);
      assertCoverageSum(`Rally '${name}'`, surfaceCoverage);
      return {
        id: toId(name),
        name,
        surfaceCoverage,
        terrainCoverage: computeTerrainCoverage(surfaceCoverage),
      };
    });
}

// ============================================================================
// Mechanics (per-level tables from the stat pages)
// ============================================================================

const MECHANICS_HEADERS = {
  speed: { 1: 'Lv.', 2: 'On-Road / Off-Road', 6: 'Water (debuff)', 10: 'Gliding' },
  coinCurve: { 1: 'Lv.', 2: 'Coin count' },
  acceleration: { 1: 'Lv.', 2: 'Time saved per level', 4: 'Recovery time' },
  miniTurbo: {
    1: 'Lv.',
    2: 'Mini-Turbo',
    3: 'Super Mini-Turbo',
    4: 'Ultra Mini-Turbo',
    5: 'Charge Jump',
    6: 'Super Charge Jump',
    7: 'Ultra Charge Jump',
  },
  handling: { 1: 'Lv.', 2: 'On-Road', 4: 'Off-Road', 6: 'Water (debuff)' },
} as const;

/** Coin counts listed in the coin-curve table (0 and 20 are fixed: +0% and +5%) */
const COIN_COLUMNS = Array.from({ length: 19 }, (_, i) => ({ coins: i + 1, col: i + 2 }));
const MAX_COIN_BONUS_PERCENT = 5;

/**
 * Read a speed/handling style column pair (value + second value) until its first blank cell.
 * Different surfaces have tables of different lengths side by side.
 */
function readColumnPair<T>(
  table: CsvRow[],
  cols: [number, number],
  build: (level: number, a: number, b: number) => T,
  label: string,
): T[] {
  const out: T[] = [];
  for (const [level, row] of table.entries()) {
    const a = parseDecimal(row[cols[0]], label);
    if (a === null) break;
    out.push(build(level, a, requireDecimal(row[cols[1]], label)));
  }
  return out;
}

function parseMechanics(csvDir: string): Omit<MechanicsResponse, 'dataVersion'> {
  const read = (file: string) => readCsv(path.join(csvDir, file));

  // Speed & Coins
  const speedRows = read('speed-coins.csv');
  const speedTable = readLevelTable(speedRows, MECHANICS_HEADERS.speed, 'Speed & Coins (speed)');
  const speedColumn = (cols: [number, number], label: string) =>
    readColumnPair(
      speedTable,
      cols,
      (level, units, bonusPercent) => ({ level, units, bonusPercent }),
      label,
    );
  const ground = speedColumn([2, 4], 'on-road/off-road speed');

  assertHeader(
    speedRows,
    Object.fromEntries(COIN_COLUMNS.map(({ coins, col }) => [col, String(coins)])),
    'Speed & Coins (coin counts)',
  );
  const coinCurve = readLevelTable(
    speedRows,
    MECHANICS_HEADERS.coinCurve,
    'Speed & Coins (coin curve)',
  ).map((row, level) => ({
    level,
    bonusPercentByCoins: [
      0,
      ...COIN_COLUMNS.map(({ col }) => requireDecimal(row[col], 'coin bonus')),
      MAX_COIN_BONUS_PERCENT,
    ],
  }));

  // Acceleration: recovery time columns (natural, charge jump)
  const acceleration = readLevelTable(
    read('acceleration.csv'),
    MECHANICS_HEADERS.acceleration,
    'Acceleration',
  ).map((row, level) => ({
    level,
    recoveryTime: {
      natural: requireDecimal(row[4], 'recovery time'),
      chargeJump: parseDecimal(row[5], 'charge jump recovery time'),
    },
  }));

  // Mini-Turbo: frames per tier
  const miniTurbo = readLevelTable(
    read('mini-turbo.csv'),
    MECHANICS_HEADERS.miniTurbo,
    'Mini-Turbo',
  ).map((row, level) => {
    const frames = (col: number) => safeParseInt(row[col], { row: level, col, rowData: row });
    return {
      level,
      frames: {
        miniTurbo: frames(2),
        superMiniTurbo: frames(3),
        ultraMiniTurbo: frames(4),
        chargeJump: frames(5),
        superChargeJump: frames(6),
        ultraChargeJump: frames(7),
      },
    };
  });

  // Handling: angular velocity + period per surface
  const handlingTable = readLevelTable(
    read('handling.csv'),
    MECHANICS_HEADERS.handling,
    'Handling',
  );
  const handlingColumn = (cols: [number, number], label: string) =>
    readColumnPair(
      handlingTable,
      cols,
      (level, angularVelocity, periodSeconds) => ({ level, angularVelocity, periodSeconds }),
      label,
    );

  return {
    speed: {
      road: ground,
      rough: ground,
      water: speedColumn([6, 8], 'water speed'),
      gliding: speedColumn([10, 12], 'gliding speed'),
    },
    coinCurve,
    acceleration,
    miniTurbo,
    handling: {
      road: handlingColumn([2, 3], 'on-road handling'),
      rough: handlingColumn([4, 5], 'off-road handling'),
      water: handlingColumn([6, 7], 'water handling'),
    },
  };
}

// ============================================================================
// Output
// ============================================================================

type Dataset = {
  /** Output file: data/<label>.json */
  label: string;
  /** Source CSVs in scripts/csv/ */
  csvs: string[];
  /** Everything in the output file except dataVersion */
  build: (csvDir: string) => Record<string, unknown>;
  validate: (payload: unknown) => void;
  summary: (body: Record<string, unknown>) => string;
};

const count = (key: string) => (body: Record<string, unknown>) =>
  `${(body[key] as unknown[]).length} ${key}`;

const DATASETS: Dataset[] = [
  {
    label: 'characters',
    csvs: ['characters.csv'],
    build: (dir) => ({ characters: parseCharacters(path.join(dir, 'characters.csv')) }),
    validate: (payload) => {
      const { characters } = CharactersResponseSchema.parse(payload);
      assertValidIds(
        'characters',
        characters.map((c) => c.id),
      );
    },
    summary: count('characters'),
  },
  {
    label: 'vehicles',
    csvs: ['vehicles.csv'],
    build: (dir) => ({ vehicles: parseVehicles(path.join(dir, 'vehicles.csv')) }),
    validate: (payload) => {
      const { vehicles } = VehiclesResponseSchema.parse(payload);
      assertValidIds(
        'vehicles',
        vehicles.map((v) => v.id),
      );
      assertValidIds(
        'vehicle tags',
        vehicles.map((v) => v.tag),
        { unique: false },
      );
    },
    summary: count('vehicles'),
  },
  {
    label: 'tracks',
    csvs: ['surface-coverage.csv'],
    build: (dir) => ({ tracks: parseTracks(path.join(dir, 'surface-coverage.csv')) }),
    validate: (payload) => {
      const { tracks } = TracksResponseSchema.parse(payload);
      assertValidIds(
        'tracks',
        tracks.map((t) => t.id),
      );
    },
    summary: count('tracks'),
  },
  {
    label: 'rallies',
    csvs: ['surface-coverage.csv'],
    build: (dir) => ({ rallies: parseRallies(path.join(dir, 'surface-coverage.csv')) }),
    validate: (payload) => {
      const { rallies } = RalliesResponseSchema.parse(payload);
      assertValidIds(
        'rallies',
        rallies.map((r) => r.id),
      );
    },
    summary: count('rallies'),
  },
  {
    label: 'mechanics',
    csvs: ['speed-coins.csv', 'acceleration.csv', 'mini-turbo.csv', 'handling.csv'],
    build: parseMechanics,
    validate: (payload) => {
      assertLevelsIndexed(MechanicsResponseSchema.parse(payload));
    },
    summary: (body) => {
      const m = body as Omit<MechanicsResponse, 'dataVersion'>;
      return `mechanics (speed 0-${m.speed.road.length - 1}, coin curve 0-${m.coinCurve.length - 1}, acceleration 0-${m.acceleration.length - 1}, mini-turbo 0-${m.miniTurbo.length - 1}, handling 0-${m.handling.road.length - 1})`;
    },
  },
];

const serialize = (dataVersion: string, body: Record<string, unknown>) =>
  `${JSON.stringify({ dataVersion, ...body }, null, 2)}\n`;

function readExistingVersion(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { dataVersion?: unknown };
  return typeof existing.dataVersion === 'string' ? existing.dataVersion : undefined;
}

function writeDataVersion(dataVersion: string): void {
  const content = `/**
 * Data version - updated when Statpedia source data is imported
 *
 * This file is auto-generated by scripts/parse-statpedia.ts
 * DO NOT EDIT MANUALLY
 */
export const DATA_VERSION = '${dataVersion}';
`;

  fs.writeFileSync(path.join(process.cwd(), 'src', 'data-version.ts'), content);
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('🚀 Parsing Statpedia CSVs...\n');

  const csvDir = path.join(process.cwd(), 'scripts', 'csv');
  const dataDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Parse and validate everything before writing anything
  const parsed = DATASETS.map((dataset) => {
    for (const csv of dataset.csvs) {
      if (!fs.existsSync(path.join(csvDir, csv))) {
        throw new Error(`Missing source CSV: scripts/csv/${csv}`);
      }
    }
    console.log(`📊 Parsing ${dataset.label}...`);
    const body = dataset.build(csvDir);
    dataset.validate({ dataVersion: NEW_DATA_VERSION, ...body });
    console.log(`   ✅ Parsed ${dataset.summary(body)}`);
    return { ...dataset, body, filePath: path.join(dataDir, `${dataset.label}.json`) };
  });

  // Keep the existing version if every file would be byte-identical under it
  const versions = new Set(parsed.map((d) => readExistingVersion(d.filePath)));
  const [existingVersion] = versions;
  const unchanged =
    versions.size === 1 &&
    existingVersion !== undefined &&
    parsed.every(
      (d) => fs.readFileSync(d.filePath, 'utf-8') === serialize(existingVersion, d.body),
    );
  const dataVersion = unchanged && !process.env.DATA_VERSION ? existingVersion : NEW_DATA_VERSION;

  if (process.env.DATA_VERSION) {
    console.warn(`\n⚠️  DATA_VERSION override set to ${dataVersion}`);
  }

  for (const d of parsed) {
    fs.writeFileSync(d.filePath, serialize(dataVersion, d.body));
  }
  writeDataVersion(dataVersion);

  console.log(
    unchanged
      ? '\n✨ Data unchanged.'
      : `\n✨ Data files generated in data/ and src/data-version.ts`,
  );
  console.log(`📅 Data version: ${dataVersion}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}
