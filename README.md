# Mario Kart World Data API

Community-maintained REST API for character stats, vehicle data, and track information from Mario Kart World.

Data source: [Mario Kart World Statpedia](https://docs.google.com/spreadsheets/d/1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc/edit).

**Base URL:** `https://hiddenvector.studio/mkw/api/v1`

**Documentation:** [Interactive API Docs](https://hiddenvector.studio/mkw/api/v1/docs)

## Quick Start

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

### Use IDs correctly

- IDs are slugs. Fetch list endpoints and use `id`.
- Example: `/characters/dry-bones`, `/vehicles/mach-rocket`, `/tracks/mario-bros-circuit`.

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

## Understanding the Data

- **Stats scale:** 0–11 in current data (higher is better).
- **surfaceCoverage:** Raw surface mix including neutral/off-road.
- **terrainCoverage:** Adjusted road/rough/water mix normalized to 100% for scoring.
- **Vehicle tags:** Same `tag` means identical stats; use `/vehicles?tag={tag}`.
- **Cups:** each track has a display `cup` (`"Mushroom Cup"`) and a slug `cupId` (`"mushroom-cup"`); filter with `/tracks?cup={cupId}`.

Example scoring formula:

```text
score = (speed.road * terrainCoverage.road)
      + (speed.rough * terrainCoverage.rough)
      + (speed.water * terrainCoverage.water)
```

Worked example (Mario Bros. Circuit + Wario):

```text
terrainCoverage: { road: 76, rough: 24, water: 0 }
Wario speed:     { road: 6,  rough: 5,  water: 5 }

score = 6*76 + 5*24 + 5*0 = 576
normalizedScore = 5.76
```

## Data Contract

- **dataVersion:** the date the data last changed. Informational; use the `ETag` for cache validation.
- **terrainCoverage:** derived from adjusted coverage columns, normalized so the three values sum to exactly 100 (2 decimal places).
- **Name normalization:** a small set of names are normalized to US variants during parsing.
- **Filters:** `?tag=` and `?cup=` return an empty list when there are no matches.
- **Stability:** field meanings are stable within `/v1`; breaking changes go to `/v2`.

## Caching

All data endpoints (collections, filtered lists, and single items) return an `ETag`.
It is derived from the response data and the service version, so it changes whenever either does.
Use `If-None-Match` to get `304 Not Modified` when nothing changed.

- Data responses: `Cache-Control: public, max-age=3600, must-revalidate`.
- `/openapi.json` and `/docs`: `public, max-age=86400`.
- `/health` and all error responses: `no-store`.

```bash
# First request - get the ETag
curl -I https://hiddenvector.studio/mkw/api/v1/characters
# ETag: "1.1.0-4k2j9x0q1z8"

# Subsequent request - use If-None-Match
curl -I -H 'If-None-Match: "1.1.0-4k2j9x0q1z8"' https://hiddenvector.studio/mkw/api/v1/characters
# HTTP/2 304
```

## Common Pitfalls

- **304 responses:** `If-None-Match` may return `304` with an empty body—use cached data.
- **ETags are opaque:** don't parse them; the format may change.
- **429 rate limits:** Cloudflare may return `429`; retry with backoff.

```ts
// Handling 304 in JS
const res = await fetch(url, { headers: { 'If-None-Match': etag } });
if (res.status === 304) return cachedData;
const data = await res.json();
```

## Data Source

Stats are sourced from the [Mario Kart World Statpedia](https://docs.google.com/spreadsheets/d/1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc/edit) maintained by the community.

Updates follow the Statpedia sheet; there is no fixed schedule.

## Development

This project runs on [Cloudflare Workers](https://developers.cloudflare.com/workers/) using [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

Requires Node.js 24 (see `.nvmrc`).

```bash
# Install dependencies
npm install

# Run locally (starts wrangler dev server at http://localhost:8787)
npm run dev

# Run everything CI runs (format, typecheck, lint, tests)
npm run check

# Regenerate data/*.json from scripts/csv/*.csv (idempotent; bumps dataVersion only on change)
npm run generate-data
```

Deploys happen automatically when a `vX.Y.Z` tag on `main` is pushed; see `RELEASING.md`.

Local API will be available at `http://localhost:8787/mkw/api/v1`.

## Versioning & Releases

- Service version = `package.json`; data version = date the generated data last changed.
- `/v1` is stable; breaking changes go to `/v2`.
- Semver: PATCH (fixes/data), MINOR (additive), MAJOR (breaking).
- Tag releases `vX.Y.Z` and publish notes from `CHANGELOG.md`.
- See `RELEASING.md` for the checklist.

## Roadmap

- [ ] Combo calculator endpoint for optimal character + vehicle combinations
- [ ] Query parameter filtering (e.g., `/characters?minSpeed=5`)
- [ ] Track recommendations based on character/vehicle stats

## License

Code is licensed under [MIT](LICENSE). Data is provided under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

---

**Not affiliated with Nintendo. Mario Kart is a trademark of Nintendo Co., Ltd.**
