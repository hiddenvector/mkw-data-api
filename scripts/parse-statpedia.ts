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

// Helper: Convert name to ID
function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/-/g, '_');
}

// Helper: Check if row has stats (numeric values in stat columns)
function hasStats(row: any[], startCol: number): boolean {
  return row[startCol] !== undefined &&
         row[startCol] !== '' &&
         !isNaN(parseInt(row[startCol]));
}

/**
 * Parse Characters CSV
 *
 * Structure:
 * - Row N: Stats (columns 7-16)
 * - Row N+1: Character names (columns 3-6)
 * - Multiple characters share the same stat line
 */
function parseCharacters(csvPath: string): Character[] {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { relax_column_count: true });

  const characters: Character[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (!row || row.every((cell: string) => !cell)) continue;

    // Look for stat rows (column 7 = On-Road Speed)
    if (hasStats(row, 7)) {
      // Parse stats from this row
      const stats: BaseStats = {
        speed: {
          road: parseInt(row[7]),
          rough: parseInt(row[8]),
          water: parseInt(row[9])
        },
        handling: {
          road: parseInt(row[14]),
          rough: parseInt(row[15]),
          water: parseInt(row[16])
        },
        acceleration: parseInt(row[10]),
        miniTurbo: parseInt(row[11]),
        weight: parseInt(row[12]),
        coinCurve: parseInt(row[13])
      };

      // Look at next row for character names (columns 3-6)
      const nextRow = rows[i + 1];
      if (nextRow) {
        const names = [nextRow[3], nextRow[4], nextRow[5], nextRow[6]]
          .filter(name => name && name.trim());

        // Create one character per name with these stats
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

  return characters;
}

/**
 * Parse Vehicles CSV
 *
 * Structure:
 * - Row N: Class, Tag, empty name columns, Stats (columns 7-16)
 * - Row N+1: Vehicle names in columns 3-5
 * - Multiple vehicle names share the same stats
 */
function parseVehicles(csvPath: string): Vehicle[] {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { relax_column_count: true });

  const vehicles: Vehicle[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows and header rows
    if (!row || row.every((cell: string) => !cell)) continue;
    if (row[1] === 'Class') continue; // Header row

    // Look for stat rows (column 7 = On-Road Speed)
    if (hasStats(row, 7)) {
      // Parse stats
      const stats: BaseStats = {
        speed: {
          road: parseInt(row[7]),
          rough: parseInt(row[8]),
          water: parseInt(row[9])
        },
        handling: {
          road: parseInt(row[14]),
          rough: parseInt(row[15]),
          water: parseInt(row[16])
        },
        acceleration: parseInt(row[10]),
        miniTurbo: parseInt(row[11]),
        weight: parseInt(row[12]),
        coinCurve: parseInt(row[13])
      };

      // Look at NEXT row for vehicle names (columns 3-6)
      const nextRow = rows[i + 1];
      if (!nextRow) continue;

      const names = [nextRow[3], nextRow[4], nextRow[5], nextRow[6]]
        .filter(name => name && name.trim());

      // Determine category based on class name (column 1)
      const className = (row[1] || '').toLowerCase();
      let category: 'kart' | 'bike' | 'atv' = 'kart'; // default

      if (className.includes('bike')) {
        category = 'bike';
      } else if (className.includes('atv')) {
        category = 'atv';
      }
      // If it has specific vehicle types, try to infer from names
      else if (names.length > 0) {
        const firstNameLower = names[0].toLowerCase();
        if (firstNameLower.includes('bike') || firstNameLower.includes('chopper')) {
          category = 'bike';
        }
      }

      // Create one vehicle per name
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

  return vehicles;
}

/**
 * Parse Tracks from Surface Coverage CSV
 *
 * Structure:
 * - Regular tracks section (rows ~6-44)
 * - Track name in column 1
 * - Need to map to cups (we'll do a simple mapping)
 */
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
    'Toad\'s Factory': 'Leaf Cup',
    'Bowser\'s Castle': 'Leaf Cup',
    'Acorn Heights': 'Leaf Cup',
    'Mario Circuit': 'Lightning Cup',
    'Rainbow Road': 'Special Cup'
  };

  let inRegularTracks = false;

  for (const row of rows) {
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
      if (trackName.includes('Average')) continue;
      if (trackName.startsWith('ℹ️')) continue;
      if (trackName.startsWith('The following')) continue;

      tracks.push({
        id: toId(trackName),
        name: trackName,
        cup: cupMapping[trackName] || 'Unknown Cup'
      });
    }
  }

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
