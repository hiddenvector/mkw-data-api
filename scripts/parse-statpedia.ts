#!/usr/bin/env tsx
/**
 * Statpedia CSV Parser
 *
 * Parses Mario Kart World Statpedia CSVs into JSON format for the API.
 * Handles the complex multi-character-per-stat-line structure.
 *
 * Usage: npm run generate-data
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import type { Character, Vehicle, Track, BaseStats, SurfaceCoverage } from '../src/schemas';

// ============================================================================
// Constants
// ============================================================================

const DATA_VERSION = new Date().toISOString().split('T')[0];

/** CSV column indices for both characters and vehicles */
const COL = {
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
 * Convert a name to a URL-safe ID (slug)
 * @example toId("Baby Peach") → "baby-peach"
 * @example toId("R.O.B. H.O.G.") → "rob-hog"
 */
function toId(name: string): string {
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
 * Safely parse an integer from a CSV cell with detailed error context
 * @throws {Error} If value is not a valid integer
 */
function safeParseInt(
  value: any,
  context?: { row?: number; col?: number; rowData?: any[] },
): number {
  const n = parseInt(value, 10);
  if (isNaN(n)) {
    let msg = `Invalid number in CSV: '${value}'`;
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
 * Safely parse a percentage string to a number
 * @example parsePercent("47%") → 47
 * @example parsePercent("47,5%") → 47.5 (handles European decimals)
 */
function parsePercent(value: string): number {
  if (!value) return 0;
  return parseFloat(value.replace('%', '').replace(',', '.'));
}

/**
 * Check if a CSV row contains stat data (non-empty numeric value at startCol)
 */
function hasStats(row: any[], startCol: number): boolean {
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
function isHeaderRow(value: any, headerText: string): boolean {
  return (
    value && typeof value === 'string' && value.trim().toLowerCase() === headerText.toLowerCase()
  );
}

/**
 * Extract names from a CSV row (columns 3-6)
 */
function extractNames(row: any[]): string[] {
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
function parseStats(row: any[], rowIndex: number): BaseStats {
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

/**
 * Parse surface coverage from a CSV row
 */
function parseSurfaceCoverage(row: any[]): SurfaceCoverage {
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
function parseTerrainCoverage(row: any[]) {
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

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a character has required fields and reasonable stat values
 */
function validateCharacter(char: Character, index: number): void {
  if (!char.id || !char.name) {
    throw new Error(`Character ${index}: missing id or name`);
  }

  // Sanity check: stats should be in reasonable ranges (0-20)
  const stats = [
    char.speed.road,
    char.speed.rough,
    char.speed.water,
    char.handling.road,
    char.handling.rough,
    char.handling.water,
    char.acceleration,
    char.miniTurbo,
    char.weight,
    char.coinCurve,
  ];

  for (const stat of stats) {
    if (stat < 0 || stat > 20) {
      throw new Error(`Character ${char.name}: invalid stat value ${stat} (expected 0-20)`);
    }
  }
}

/**
 * Validate a vehicle has required fields and reasonable stat values
 */
function validateVehicle(vehicle: Vehicle, index: number): void {
  if (!vehicle.id || !vehicle.name) {
    throw new Error(`Vehicle ${index}: missing id or name`);
  }

  if (!vehicle.tag) {
    console.warn(`⚠️  Vehicle ${vehicle.name}: missing tag`);
  }
}

/**
 * Validate a track has required fields
 */
function validateTrack(track: Track, index: number): void {
  if (!track.id || !track.name) {
    throw new Error(`Track ${index}: missing id or name`);
  }

  if (track.cup === 'Unknown Cup') {
    console.warn(`⚠️  Track ${track.name}: unknown cup (not in mapping)`);
  }

  // Validate surface coverage adds up to ~100% (allow some tolerance for rounding)
  if (track.surfaceCoverage) {
    const total =
      track.surfaceCoverage.road +
      track.surfaceCoverage.rough +
      track.surfaceCoverage.water +
      track.surfaceCoverage.neutral +
      track.surfaceCoverage.offRoad;

    if (total < 95 || total > 105) {
      console.warn(
        `⚠️  Track ${track.name}: surface coverage sums to ${total.toFixed(1)}% (expected ~100%)`,
      );
    }
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
        console.warn(`⚠️  Row ${i + 1}: stat row has no following name row`);
        continue;
      }

      const names = extractNames(nextRow);
      if (names.length === 0) {
        console.warn(`⚠️  Row ${i + 1}: no character names found`);
        continue;
      }

      // Create one character per name with shared stats
      for (const name of names) {
        const character: Character = {
          id: toId(name),
          name,
          ...stats,
        };

        validateCharacter(character, characters.length);
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

      // Get vehicle names from next row
      const nextRow = rows[i + 1];
      if (!nextRow) {
        console.warn(`⚠️  Row ${i + 1}: stat row has no following name row`);
        continue;
      }

      const names = extractNames(nextRow);
      if (names.length === 0) {
        console.warn(`⚠️  Row ${i + 1}: no vehicle names found`);
        continue;
      }

      // Create one vehicle per name with shared stats
      for (const name of names) {
        const vehicle: Vehicle = {
          id: toId(name),
          name,
          tag,
          ...stats,
        };

        validateVehicle(vehicle, vehicles.length);
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

      const track: Track = {
        id: toId(trackName),
        name: trackName,
        cup: CUP_MAPPING[trackName] || 'Unknown Cup',
        surfaceCoverage: parseSurfaceCoverage(row),
        terrainCoverage: parseTerrainCoverage(row),
      };

      validateTrack(track, tracks.length);
      tracks.push(track);
    }
  }

  return tracks;
}

// ============================================================================
// File I/O
// ============================================================================

/**
 * Write parsed data to JSON file with versioning
 */
function writeJSON<T>(filePath: string, data: T, label: string): void {
  const json = JSON.stringify(
    {
      dataVersion: DATA_VERSION,
      [label]: data,
    },
    null,
    2,
  );

  fs.writeFileSync(filePath, json);
}

/**
 * Write the data version constant to TypeScript file
 */
function writeDataVersion(): void {
  const content = `/**
 * Data version - updated when Statpedia source data is imported
 *
 * This file is auto-generated by scripts/parse-statpedia.ts
 * DO NOT EDIT MANUALLY
 */
export const DATA_VERSION = '${DATA_VERSION}';
`;

  const filePath = path.join(process.cwd(), 'src', 'data-version.ts');
  fs.writeFileSync(filePath, content);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🚀 Parsing Statpedia CSVs...\n');

  const csvDir = path.join(process.cwd(), 'scripts', 'csv');
  const dataDir = path.join(process.cwd(), 'data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write data version constant
  writeDataVersion();
  console.log(`📅 Generated src/data-version.ts (${DATA_VERSION})\n`);

  // Parse characters
  const charactersPath = path.join(csvDir, 'characters.csv');
  if (fs.existsSync(charactersPath)) {
    console.log('📊 Parsing characters...');
    const characters = parseCharacters(charactersPath);
    console.log(`   ✅ Parsed ${characters.length} characters`);

    writeJSON(path.join(dataDir, 'characters.json'), characters, 'characters');
    console.log('   💾 Wrote data/characters.json\n');
  } else {
    console.log('   ⚠️  characters.csv not found, skipping\n');
  }

  // Parse vehicles
  const vehiclesPath = path.join(csvDir, 'vehicles.csv');
  if (fs.existsSync(vehiclesPath)) {
    console.log('📊 Parsing vehicles...');
    const vehicles = parseVehicles(vehiclesPath);
    console.log(`   ✅ Parsed ${vehicles.length} vehicles`);

    writeJSON(path.join(dataDir, 'vehicles.json'), vehicles, 'vehicles');
    console.log('   💾 Wrote data/vehicles.json\n');
  } else {
    console.log('   ⚠️  vehicles.csv not found, skipping\n');
  }

  // Parse tracks
  const tracksPath = path.join(csvDir, 'surface-coverage.csv');
  if (fs.existsSync(tracksPath)) {
    console.log('📊 Parsing tracks...');
    const tracks = parseTracks(tracksPath);
    console.log(`   ✅ Parsed ${tracks.length} tracks`);

    writeJSON(path.join(dataDir, 'tracks.json'), tracks, 'tracks');
    console.log('   💾 Wrote data/tracks.json\n');
  } else {
    console.log('   ⚠️  surface-coverage.csv not found, skipping\n');
  }

  console.log('✨ Done! Data files generated in data/');
  console.log(`📅 Data version: ${DATA_VERSION}`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
