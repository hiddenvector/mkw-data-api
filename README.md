# Mario Kart World Data API

Community-maintained REST API for character stats, vehicle data, and track information from Mario Kart World.

**Base URL:** `https://hiddenvector.studio/mkw/api/v1`

**Documentation:** [Interactive API Docs](https://hiddenvector.studio/mkw/api/v1/docs)

## Features

- **50 playable characters** with terrain-specific stats (road, rough, water)
- **40 vehicles** with stat tags for identical builds
- **30 tracks** with raw surface coverage and adjusted terrain coverage
- ETag-based caching and OpenAPI 3.1 docs

## Understanding the Data

- **Stats scale:** All stats are 0–20; higher is better.
- **surfaceCoverage:** Raw surface breakdown including neutral/off-road.
- **terrainCoverage:** Adjusted road/rough/water mix normalized to 100% (excludes neutral/off-road).
- **Vehicle tags:** Same `tag` means identical stats; use `/vehicles?tag={tag}`.

Example: score a build with terrainCoverage

```text
score = (speed.road * terrainCoverage.road)
      + (speed.rough * terrainCoverage.rough)
      + (speed.water * terrainCoverage.water)
```

Worked example (Mario Bros. Circuit + Wario)

```text
terrainCoverage: { road: 76, rough: 24, water: 0 }
Wario speed:     { road: 6,  rough: 5,  water: 5 }

score = 6*76 + 5*24 + 5*0 = 576
```

To normalize, divide by 100:

```text
normalizedScore = 5.76
```

## Data Contract

- **dataVersion:** changes when Statpedia data changes; use it to refresh cached results.
- **terrainCoverage:** derived from the adjusted coverage columns in the Statpedia sheet and normalized to 100% (road/rough/water only).
- **Name standardization:** a small set of names are normalized to US variants during parsing (see `scripts/parse-statpedia.ts`).
- **Filters:** `?tag=` and `?cup=` return an empty list when there are no matches.

## Stability

- Field meanings are stable within `/v1`.
- New fields and endpoints are additive; breaking changes require `/v2`.

## Data Provenance

- Source: Mario Kart World Statpedia (linked below).
- Updates are synced when the sheet changes; `dataVersion` reflects the import date.

## Quick Start

### Fetch and render a list

```ts
// Minimal example: fetch characters and print the first 3
const res = await fetch('https://hiddenvector.studio/mkw/api/v1/characters');
const data = await res.json();

console.log('Data version:', data.dataVersion);
console.log(data.characters.slice(0, 3));
```

### Use IDs correctly

- IDs are slugs. Fetch list endpoints and use `id`.
- Example: `/characters/dry-bones`, `/vehicles/mach-rocket`, `/tracks/mario-bros-circuit`.

```bash
# Get all characters
curl https://hiddenvector.studio/mkw/api/v1/characters

# Get a specific character
curl https://hiddenvector.studio/mkw/api/v1/characters/dry-bones

# Get all vehicles
curl https://hiddenvector.studio/mkw/api/v1/vehicles

# Get vehicles by stat tag
curl "https://hiddenvector.studio/mkw/api/v1/vehicles?tag=st-a-0"

# Get all tracks
curl https://hiddenvector.studio/mkw/api/v1/tracks

# Get tracks by cup
curl "https://hiddenvector.studio/mkw/api/v1/tracks?cup=mushroom-cup"
```

## Endpoints

| Endpoint                  | Description                   |
| ------------------------- | ----------------------------- |
| `GET /health`             | API health and version info   |
| `GET /characters`         | List all characters           |
| `GET /characters/{id}`    | Get character by ID           |
| `GET /vehicles`           | List all vehicles             |
| `GET /vehicles/{id}`      | Get vehicle by ID             |
| `GET /vehicles?tag={tag}` | Get vehicles by stat tag      |
| `GET /tracks`             | List all tracks               |
| `GET /tracks/{id}`        | Get track by ID               |
| `GET /tracks?cup={cup}`   | Get tracks by cup             |
| `GET /openapi.json`       | OpenAPI 3.1 specification     |
| `GET /docs`               | Interactive API documentation |

## Caching

Collection endpoints (`/characters`, `/vehicles`, `/tracks`) return an `ETag` based on `dataVersion`.
Use `If-None-Match` to get `304 Not Modified` when nothing changed.

```bash
# First request - get the ETag
curl -I https://hiddenvector.studio/mkw/api/v1/characters
# ETag: "2026-01-25"

# Subsequent request - use If-None-Match
curl -I -H 'If-None-Match: "2026-01-25"' https://hiddenvector.studio/mkw/api/v1/characters
# HTTP/2 304
```

## Common Pitfalls

- **304 responses:** `If-None-Match` may return `304` with an empty body—use cached data.
- **429 rate limits:** Cloudflare may return `429`; retry with backoff.

```ts
// Handling 304 in JS
const res = await fetch(url, { headers: { 'If-None-Match': etag } });
if (res.status === 304) return cachedData;
const data = await res.json();
```

## Data Source

Stats are sourced from the [Mario Kart World Statpedia](https://docs.google.com/spreadsheets/d/1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc/edit) maintained by the community.

## Development

This project runs on [Cloudflare Workers](https://developers.cloudflare.com/workers/) using [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```bash
# Install dependencies
npm install

# Run locally (starts wrangler dev server at http://localhost:8787)
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Deploy to Cloudflare Workers
npm run deploy
```

Local API will be available at `http://localhost:8787/mkw/api/v1`.

## Versioning & Releases

- `package.json` version tracks the service release.
- `dataVersion` tracks Statpedia data changes.
- `/v1` is the API major; breaking changes require `/v2`.
- Releases use semantic versioning: PATCH (fixes/data), MINOR (additive), MAJOR (breaking).
- Tag releases as `vX.Y.Z` and publish release notes from `CHANGELOG.md`.
- See `RELEASING.md` for the checklist.

## Roadmap

- [ ] Combo calculator endpoint for optimal character + vehicle combinations
- [ ] Query parameter filtering (e.g., `/characters?minSpeed=5`)
- [ ] Track recommendations based on character/vehicle stats

## License

Code is licensed under [MIT](LICENSE). Data is provided under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

---

**Not affiliated with Nintendo. Mario Kart is a trademark of Nintendo Co., Ltd.**
