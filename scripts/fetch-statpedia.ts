#!/usr/bin/env tsx
/**
 * Downloads the Statpedia tabs the generator reads into scripts/csv/.
 *
 * Usage: npm run fetch-data && npm run generate-data
 *
 * Tabs are addressed by gid (stable across renames). If a download fails or returns
 * something other than CSV (e.g. the sheet was made private), nothing is overwritten.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The Mario Kart World Statpedia (public Google Sheet) */
export const SHEET_ID = '1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc';

export const TABS = [
  { name: 'Characters', gid: '2145745776', file: 'characters.csv' },
  { name: 'Vehicles', gid: '679558948', file: 'vehicles.csv' },
  { name: 'Surface Coverage', gid: '910105117', file: 'surface-coverage.csv' },
  { name: 'Speed & Coins', gid: '1894354611', file: 'speed-coins.csv' },
  { name: 'Acceleration', gid: '1141904571', file: 'acceleration.csv' },
  { name: 'Mini-Turbo', gid: '1658694521', file: 'mini-turbo.csv' },
  { name: 'Handling', gid: '1987061506', file: 'handling.csv' },
] as const;

const exportUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

async function download(tab: (typeof TABS)[number]): Promise<string> {
  const res = await fetch(exportUrl(tab.gid));
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || !contentType.startsWith('text/csv')) {
    throw new Error(
      `${tab.name}: expected CSV, got HTTP ${res.status} (${contentType || 'no content-type'}). Is the sheet still public, and is the gid still ${tab.gid}?`,
    );
  }
  return res.text();
}

async function main() {
  const csvDir = path.join(process.cwd(), 'scripts', 'csv');

  // Download everything first so a failure leaves the existing CSVs untouched
  const results = await Promise.all(TABS.map(async (tab) => ({ tab, csv: await download(tab) })));

  for (const { tab, csv } of results) {
    fs.writeFileSync(path.join(csvDir, tab.file), csv);
    console.log(`✅ ${tab.name} → scripts/csv/${tab.file} (${csv.split('\n').length} lines)`);
  }
  console.log('\nNext: npm run generate-data');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
