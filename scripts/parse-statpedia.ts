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
  TracksResponseSchema,
  VehiclesResponseSchema,
  type BaseStats,
  type Character,
  type Track,
  type Vehicle,
} from '../src/schemas';
import { assertValidIds } from '../src/lib/validate';
import {
  COL,
  type CsvRow,
  normalizeDisplayName,
  parseSurfaceCoverage,
  parseTerrainCoverage,
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
 * Check if a CSV row contains stat data (non-empty numeric value at startCol)
 */
function hasStats(row: CsvRow, startCol: number): boolean {
  return (
    row &&
    row[startCol] !== undefined &&
    row[startCol] !== '' &&
    !isNaN(parseInt(row[startCol], 10))
  );
}

/**
 * Check if a string is a header row identifier
 */
function isHeaderRow(value: string | undefined, headerText: string): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === headerText.toLowerCase();
}

/**
 * Extract names from a CSV row (columns 3-6)
 */
function extractNames(row: CsvRow): string[] {
  return [row[COL.NAME_1], row[COL.NAME_2], row[COL.NAME_3], row[COL.NAME_4]]
    .filter((name): name is string => Boolean(name && name.trim()))
    .map((name) => name.trim());
}

// ============================================================================
// Stat Parsing
// ============================================================================

/**
 * Parse BaseStats from a CSV row (shared by characters and vehicles)
 */
function parseStats(row: CsvRow, rowIndex: number): BaseStats {
  const ctx = (col: number) => ({ row: rowIndex, col, rowData: row });

  return {
    speed: {
      road: safeParseInt(row[COL.SPEED_ROAD], ctx(COL.SPEED_ROAD)),
      rough: safeParseInt(row[COL.SPEED_ROUGH], ctx(COL.SPEED_ROUGH)),
      water: safeParseInt(row[COL.SPEED_WATER], ctx(COL.SPEED_WATER)),
    },
    handling: {
      road: safeParseInt(row[COL.HANDLING_ROAD], ctx(COL.HANDLING_ROAD)),
      rough: safeParseInt(row[COL.HANDLING_ROUGH], ctx(COL.HANDLING_ROUGH)),
      water: safeParseInt(row[COL.HANDLING_WATER], ctx(COL.HANDLING_WATER)),
    },
    acceleration: safeParseInt(row[COL.ACCELERATION], ctx(COL.ACCELERATION)),
    miniTurbo: safeParseInt(row[COL.MINI_TURBO], ctx(COL.MINI_TURBO)),
    weight: safeParseInt(row[COL.WEIGHT], ctx(COL.WEIGHT)),
    coinCurve: safeParseInt(row[COL.COIN_CURVE], ctx(COL.COIN_CURVE)),
  };
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

  const total = Object.values(track.surfaceCoverage).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > SURFACE_COVERAGE_TOLERANCE) {
    throw new Error(
      `Track '${track.name}': surface coverage sums to ${total.toFixed(1)}% (expected 100 ± ${SURFACE_COVERAGE_TOLERANCE})`,
    );
  }
}

// ============================================================================
// CSV Parsers
// ============================================================================

/**
 * Parse Characters CSV
 *
 * Structure:
 * - Row N: Stats in columns 7-16
 * - Row N+1: Character names in columns 3-6
 * - Multiple characters can share the same stat line
 */
function parseCharacters(csvPath: string): Character[] {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { relax_column_count: true });

  const characters: Character[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (!row || row.every((cell: string) => !cell)) continue;

    // Look for stat rows
    if (hasStats(row, COL.SPEED_ROAD)) {
      const stats = parseStats(row, i);

      // Get character names from next row
      const nextRow = rows[i + 1];
      if (!nextRow) {
        throw new Error(`Row ${i + 1}: stat row has no following name row`);
      }

      const names = extractNames(nextRow);
      if (names.length === 0) {
        throw new Error(`Row ${i + 1}: no character names found`);
      }

      // Create one character per name with shared stats
      for (const name of names) {
        const displayName = normalizeDisplayName(name);
        const character: Character = {
          id: toId(displayName),
          name: displayName,
          ...stats,
        };

        characters.push(character);
      }
    }
  }

  return characters;
}

/**
 * Parse Vehicles CSV
 *
 * Structure:
 * - Row N: Class, Tag, empty name columns, Stats (columns 7-16)
 * - Row N+1: Vehicle names in columns 3-6
 * - Multiple vehicles can share the same stat line
 */
function parseVehicles(csvPath: string): Vehicle[] {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { relax_column_count: true });

  const vehicles: Vehicle[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (!row || row.every((cell: string) => !cell)) continue;

    // Skip header row
    if (isHeaderRow(row[COL.CLASS], 'class')) continue;

    // Look for stat rows
    if (hasStats(row, COL.SPEED_ROAD)) {
      const stats = parseStats(row, i);
      const tag = (row[COL.TAG] || '').trim().toLowerCase();
      if (!tag) {
        throw new Error(`Row ${i + 1}: vehicle stat row has no tag`);
      }

      // Get vehicle names from next row
      const nextRow = rows[i + 1];
      if (!nextRow) {
        throw new Error(`Row ${i + 1}: stat row has no following name row`);
      }

      const names = extractNames(nextRow);
      if (names.length === 0) {
        throw new Error(`Row ${i + 1}: no vehicle names found`);
      }

      // Create one vehicle per name with shared stats
      for (const name of names) {
        const vehicle: Vehicle = {
          id: toId(name),
          name,
          tag,
          ...stats,
        };

        vehicles.push(vehicle);
      }
    }
  }

  return vehicles;
}

/**
 * Parse Tracks from Surface Coverage CSV
 *
 * Structure:
 * - Regular Tracks section contains track data
 * - Track name in column 1
 * - Surface coverage percentages in columns 3-7
 */
function parseTracks(csvPath: string): Track[] {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { relax_column_count: true });

  const tracks: Track[] = [];
  let inRegularTracks = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Start parsing after "Regular Tracks" header
    if (row[COL.TRACK_NAME] === 'Regular Tracks') {
      inRegularTracks = true;
      continue;
    }

    // Stop at "Knock-Out Tour" section
    if (row[COL.TRACK_NAME] === 'Knock-Out Tour') {
      break;
    }

    if (
      inRegularTracks &&
      row[COL.TRACK_NAME] &&
      row[COL.TRACK_NAME] !== 'Track' &&
      row[COL.TRACK_NAME] !== 'Name'
    ) {
      const trackName = row[COL.TRACK_NAME].trim();

      // Skip summary rows and explanatory text
      if (
        !trackName ||
        trackName.toLowerCase().includes('average') ||
        trackName.startsWith('ℹ️') ||
        trackName.startsWith('The following') ||
        trackName.toLowerCase().includes('surface coverage')
      ) {
        continue;
      }

      const cup = CUP_MAPPING[trackName] ?? '';
      const track: Track = {
        id: toId(trackName),
        name: trackName,
        cup,
        cupId: toId(cup),
        surfaceCoverage: parseSurfaceCoverage(row),
        terrainCoverage: parseTerrainCoverage(row),
      };

      validateTrack(track);
      tracks.push(track);
    }
  }

  return tracks;
}

// ============================================================================
// Output
// ============================================================================

type Dataset = {
  label: 'characters' | 'vehicles' | 'tracks';
  csv: string;
  parse: (csvPath: string) => unknown[];
  validate: (payload: unknown) => void;
};

const DATASETS: Dataset[] = [
  {
    label: 'characters',
    csv: 'characters.csv',
    parse: parseCharacters,
    validate: (payload) => {
      const { characters } = CharactersResponseSchema.parse(payload);
      assertValidIds(
        'characters',
        characters.map((c) => c.id),
      );
    },
  },
  {
    label: 'vehicles',
    csv: 'vehicles.csv',
    parse: parseVehicles,
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
  },
  {
    label: 'tracks',
    csv: 'surface-coverage.csv',
    parse: parseTracks,
    validate: (payload) => {
      const { tracks } = TracksResponseSchema.parse(payload);
      assertValidIds(
        'tracks',
        tracks.map((t) => t.id),
      );
    },
  },
];

const serialize = (dataVersion: string, label: string, items: unknown[]) =>
  `${JSON.stringify({ dataVersion, [label]: items }, null, 2)}\n`;

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
    const csvPath = path.join(csvDir, dataset.csv);
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Missing source CSV: scripts/csv/${dataset.csv}`);
    }
    console.log(`📊 Parsing ${dataset.label}...`);
    const items = dataset.parse(csvPath);
    dataset.validate({ dataVersion: NEW_DATA_VERSION, [dataset.label]: items });
    console.log(`   ✅ Parsed ${items.length} ${dataset.label}`);
    return { ...dataset, items, filePath: path.join(dataDir, `${dataset.label}.json`) };
  });

  // Keep the existing version if every file would be byte-identical under it
  const versions = new Set(parsed.map((d) => readExistingVersion(d.filePath)));
  const [existingVersion] = versions;
  const unchanged =
    versions.size === 1 &&
    existingVersion !== undefined &&
    parsed.every(
      (d) => fs.readFileSync(d.filePath, 'utf-8') === serialize(existingVersion, d.label, d.items),
    );
  const dataVersion = unchanged && !process.env.DATA_VERSION ? existingVersion : NEW_DATA_VERSION;

  if (process.env.DATA_VERSION) {
    console.warn(`\n⚠️  DATA_VERSION override set to ${dataVersion}`);
  }

  for (const d of parsed) {
    fs.writeFileSync(d.filePath, serialize(dataVersion, d.label, d.items));
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
