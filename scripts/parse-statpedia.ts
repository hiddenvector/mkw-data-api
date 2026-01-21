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
import type { Character, Vehicle, Track, TerrainStats, BaseStats } from '../src/types';

// Helper: Convert name to ID (slug with hyphens)
function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/_/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper: Safe parseInt (throws if NaN or undefined, with row/col info)
function safeParseInt(value: any, rowIdx?: number, colIdx?: number, rowSnippet?: any[]): number {
  const n = parseInt(value);
  if (isNaN(n)) {
    let msg = `Invalid number in CSV: '${value}'`;
    if (rowIdx !== undefined && colIdx !== undefined) {
      msg += ` (row ${rowIdx + 1}, col ${colIdx + 1})`;
    }
    if (rowSnippet) {
      msg += `\nRow: ${JSON.stringify(rowSnippet)}`;
    }
    throw new Error(msg);
  }
  return n;
}

// Column indices for stats (for maintainability)
const COL = {
  // Shared
  NAME_1: 3,
  NAME_2: 4,
  NAME_3: 5,
  NAME_4: 6,
  // Stats
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
};

// Helper: Check if row has stats (numeric values in stat columns)
function hasStats(row: any[], startCol: number): boolean {
  return row && row[startCol] !== undefined &&
         row[startCol] !== '' &&
         !isNaN(parseInt(row[startCol]));
}

function parseCharacters(csvPath: string): Character[] {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { relax_column_count: true });

  const characters: Character[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell: string) => !cell)) continue;

    if (hasStats(row, COL.SPEED_ROAD)) {
      let stats: BaseStats;
      try {
        stats = {
          speed: {
            road: safeParseInt(row[COL.SPEED_ROAD], i, COL.SPEED_ROAD, row),
            rough: safeParseInt(row[COL.SPEED_ROUGH], i, COL.SPEED_ROUGH, row),
            water: safeParseInt(row[COL.SPEED_WATER], i, COL.SPEED_WATER, row)
          },
          handling: {
            road: safeParseInt(row[COL.HANDLING_ROAD], i, COL.HANDLING_ROAD, row),
            rough: safeParseInt(row[COL.HANDLING_ROUGH], i, COL.HANDLING_ROUGH, row),
            water: safeParseInt(row[COL.HANDLING_WATER], i, COL.HANDLING_WATER, row)
          },
          acceleration: safeParseInt(row[COL.ACCELERATION], i, COL.ACCELERATION, row),
          miniTurbo: safeParseInt(row[COL.MINI_TURBO], i, COL.MINI_TURBO, row),
          weight: safeParseInt(row[COL.WEIGHT], i, COL.WEIGHT, row),
          coinCurve: safeParseInt(row[COL.COIN_CURVE], i, COL.COIN_CURVE, row)
        };
      } catch (err) {
        throw new Error(`Characters CSV: ${err instanceof Error ? err.message : err}`);
      }
      // Look at next row for character names (columns 3-6)
      const nextRow = rows[i + 1];
      if (nextRow) {
        const names = [nextRow[COL.NAME_1], nextRow[COL.NAME_2], nextRow[COL.NAME_3], nextRow[COL.NAME_4]]
          .filter(name => name && name.trim());
        for (const name of names) {
          characters.push({
            id: toId(name),
            name: name.trim(),
            ...stats
          });
        }
      }
    }
  }
  console.log(`[parseCharacters] Parsed ${characters.length} characters.`);
  return characters;
}

function parseVehicles(csvPath: string): Vehicle[] {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { relax_column_count: true });

  const vehicles: Vehicle[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell: string) => !cell)) continue;

    // Header row check (robust: trim/case-insensitive)
    if (row[1] && typeof row[1] === 'string' && row[1].trim().toLowerCase() === 'class') continue;

    if (hasStats(row, COL.SPEED_ROAD)) {
      let stats: BaseStats;
      try {
        stats = {
          speed: {
            road: safeParseInt(row[COL.SPEED_ROAD], i, COL.SPEED_ROAD, row),
            rough: safeParseInt(row[COL.SPEED_ROUGH], i, COL.SPEED_ROUGH, row),
            water: safeParseInt(row[COL.SPEED_WATER], i, COL.SPEED_WATER, row)
          },
          handling: {
            road: safeParseInt(row[COL.HANDLING_ROAD], i, COL.HANDLING_ROAD, row),
            rough: safeParseInt(row[COL.HANDLING_ROUGH], i, COL.HANDLING_ROUGH, row),
            water: safeParseInt(row[COL.HANDLING_WATER], i, COL.HANDLING_WATER, row)
          },
          acceleration: safeParseInt(row[COL.ACCELERATION], i, COL.ACCELERATION, row),
          miniTurbo: safeParseInt(row[COL.MINI_TURBO], i, COL.MINI_TURBO, row),
          weight: safeParseInt(row[COL.WEIGHT], i, COL.WEIGHT, row),
          coinCurve: safeParseInt(row[COL.COIN_CURVE], i, COL.COIN_CURVE, row)
        };
      } catch (err) {
        throw new Error(`Vehicles CSV: ${err instanceof Error ? err.message : err}`);
      }
      const nextRow = rows[i + 1];
      if (!nextRow) continue;
      const names = [nextRow[COL.NAME_1], nextRow[COL.NAME_2], nextRow[COL.NAME_3], nextRow[COL.NAME_4]]
        .filter(name => name && name.trim());
      if (names.length === 0) continue;
      const className = (row[1] || '').toLowerCase();
      let category: 'kart' | 'bike' | 'atv' = 'kart';
      if (className.includes('bike')) {
        category = 'bike';
      } else if (className.includes('atv')) {
        category = 'atv';
      } else if (names.length > 0) {
        const firstNameLower = names[0].toLowerCase();
        if (firstNameLower.includes('bike') || firstNameLower.includes('chopper')) {
          category = 'bike';
        }
      }
      for (const name of names) {
        vehicles.push({
          id: toId(name),
          name: name.trim(),
          category,
          ...stats
        });
      }
    }
  }
  console.log(`[parseVehicles] Parsed ${vehicles.length} vehicles.`);
  return vehicles;
}

function parseTracks(csvPath: string): Track[] {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { relax_column_count: true });

  const tracks: Track[] = [];

  // Simple cup mapping (you can refine this)
  const cupMapping: Record<string, string> = {
    'Mario Bros. Circuit': 'Mushroom Cup',
    'Crown City': 'Mushroom Cup',
    'Whistlestop Summit': 'Mushroom Cup',
    'DK Spaceport': 'Mushroom Cup',
    'Desert Hills': 'Flower Cup',
    'Shy Guy Bazaar': 'Flower Cup',
    'Wario Stadium': 'Flower Cup',
    'Airship Fortress': 'Flower Cup',
    'DK Pass': 'Star Cup',
    'Starview Peak': 'Star Cup',
    'Sky-High Sundae': 'Star Cup',
    'Wario Shipyard': 'Star Cup',
    'Koopa Troopa Beach': 'Special Cup',
    'Faraway Oasis': 'Special Cup',
    'Peach Stadium': 'Special Cup',
    'Peach Beach': 'Special Cup',
    'Salty Salty Speedway': 'Shell Cup',
    'Dino Dino Jungle': 'Shell Cup',
    'Great ? Block Ruins': 'Shell Cup',
    'Cheep Cheep Falls': 'Shell Cup',
    'Dandelion Depths': 'Banana Cup',
    'Boo Cinema': 'Banana Cup',
    'Dry Bones Burnout': 'Banana Cup',
    'Moo Moo Meadows': 'Banana Cup',
    'Choco Mountain': 'Leaf Cup',
    "Toad's Factory": 'Leaf Cup',
    "Bowser's Castle": 'Leaf Cup',
    'Acorn Heights': 'Leaf Cup',
    'Mario Circuit': 'Lightning Cup',
    'Rainbow Road': 'Special Cup'
  };

  let inRegularTracks = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Start parsing after "Regular Tracks" header
    if (row[1] === 'Regular Tracks') {
      inRegularTracks = true;
      continue;
    }
    // Stop at "Knock-Out Tour" section
    if (row[1] === 'Knock-Out Tour') {
      break;
    }
    if (inRegularTracks && row[1] && row[1] !== 'Track' && row[1] !== 'Name') {
      const trackName = row[1].trim();
      // Skip summary rows and explanatory text
      if (!trackName ||
          trackName.toLowerCase().includes('average') ||
          trackName.startsWith('ℹ️') ||
          trackName.startsWith('The following') ||
          trackName.toLowerCase().includes('surface coverage') ||
          trackName.toLowerCase().includes('info:') ||
          trackName.toLowerCase().includes('summary')
      ) continue;
      tracks.push({
        id: toId(trackName),
        name: trackName,
        cup: cupMapping[trackName] || 'Unknown Cup'
      });
    }
  }
  console.log(`[parseTracks] Parsed ${tracks.length} tracks.`);
  return tracks;
}

// Main execution
async function main() {
  console.log('🚀 Parsing Statpedia CSVs...\n');

  const csvDir = path.join(process.cwd(), 'scripts', 'csv');
  const dataDir = path.join(process.cwd(), 'data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Parse characters
  const charactersPath = path.join(csvDir, 'characters.csv');
  if (fs.existsSync(charactersPath)) {
    console.log('📊 Parsing characters...');
    const characters = parseCharacters(charactersPath);
    console.log(`   ✅ Parsed ${characters.length} characters`);

    fs.writeFileSync(
      path.join(dataDir, 'characters.json'),
      JSON.stringify({ characters }, null, 2)
    );
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

    fs.writeFileSync(
      path.join(dataDir, 'vehicles.json'),
      JSON.stringify({ vehicles }, null, 2)
    );
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

    fs.writeFileSync(
      path.join(dataDir, 'tracks.json'),
      JSON.stringify({ tracks }, null, 2)
    );
    console.log('   💾 Wrote data/tracks.json\n');
  } else {
    console.log('   ⚠️  surface-coverage.csv not found, skipping\n');
  }

  console.log('✨ Done! Data files generated in data/');
}

main().catch(console.error);
