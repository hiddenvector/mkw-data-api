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
curl "https://hiddenvector.studio/mkw/api/v1/vehicles?tag=st-a-2"

# Get all tracks
curl https://hiddenvector.studio/mkw/api/v1/tracks

# Get tracks by cup
curl "https://hiddenvector.studio/mkw/api/v1/tracks?cup=mushroom-cup"

# Get Knockout Tour rallies
curl https://hiddenvector.studio/mkw/api/v1/rallies

# Get stat mechanics (what each stat level means in-game)
curl https://hiddenvector.studio/mkw/api/v1/mechanics
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
| `GET /rallies`            | List Knockout Tour rallies    |
| `GET /rallies/{id}`       | Get rally by ID               |
| `GET /mechanics`          | Stat level → in-game values   |
| `GET /openapi.json`       | OpenAPI 3.1 specification     |
| `GET /docs`               | Interactive API documentation |

## Understanding the Data

- **Stats scale:** 0–13 in current data (higher is better). Speed has four types (`road`, `rough`, `water`, `gliding`); handling has three, because handling while gliding is the same for everyone.
- **Hidden stats:** `miniTurbo`, `coinCurve` and `invincibility` aren't shown in the game's selection screen.
- **Classes:** characters have a frame `size` (Small/Medium/Large) and weight `class` (Fly … Super Heavy); vehicles have a `class` (e.g. Light On-Roader). Names are as used in the Statpedia.
- **surfaceCoverage:** full surface mix: `road`, `rough` (called Off-Road in the Statpedia), `water`, `gliding`, and `neutral` (heavy off-road, rails, walls, cannon gliders: same speed for everyone). `offRoad` is deprecated and always `0`.
- **terrainCoverage:** road/rough/water only, rescaled to 100%, for weighting per-surface stats.
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
terrainCoverage: { road: 75.81, rough: 24.19, water: 0 }
Wario speed:     { road: 6,     rough: 5,     water: 5 }

score = 6*75.81 + 5*24.19 + 5*0 = 575.81
normalizedScore = 5.76
```

To include gliding in a speed score, weight `speed.gliding` by `surfaceCoverage.gliding` alongside the terrain terms.

### Rallies

`/rallies` has the released Knockout Tour rallies with the same `surfaceCoverage` and `terrainCoverage` as tracks (without the deprecated `offRoad`). Coverage covers the whole rally.

### Mechanics

`/mechanics` converts stat levels into in-game values, from the Statpedia's stat pages. A combo's level for a stat is the character's stat plus the vehicle's, and every table is an array indexed by level:

```ts
const level = character.speed.road + vehicle.speed.road;
mechanics.speed.road[level].units; // base max speed (100 = level 0 on road)

const coinLevel = character.coinCurve + vehicle.coinCurve;
mechanics.coinCurve[coinLevel].bonusPercentByCoins[10]; // % speed bonus holding 10 coins
```

| Table                              | Per level                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `speed.{road,rough,water,gliding}` | `units` (speed units) and `bonusPercent` over level 0; water includes the 0.9x watercraft debuff |
| `coinCurve`                        | `bonusPercentByCoins[0..20]`: total speed bonus by coins held (20 coins is always +5%)           |
| `acceleration`                     | `recoveryTime.natural` / `.chargeJump`: seconds to reach max speed (estimates)                   |
| `miniTurbo`                        | `frames` for each mini-turbo and charge-jump tier (rail and wall jumps match charge jumps)       |
| `handling.{road,rough,water}`      | `angularVelocity` (rad/s) while drifting and `periodSeconds` for a full turn                     |

## Data Contract

- **dataVersion:** the date the data last changed. Informational; use the `ETag` for cache validation.
- **terrainCoverage:** computed from `surfaceCoverage` road/rough/water, rescaled so the three values sum to exactly 100 (2 decimal places).
- **Vehicle tags:** follow the Statpedia's naming, which can change between data versions (e.g. `st-a-0` became `st-a-2` in 1.2.0). Fetch `/vehicles` to discover current tags rather than hard-coding them.
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
- **429 rate limits:** requests are rate limited per client IP at Cloudflare's edge (currently 60 requests per 10 seconds).
  Limited requests get `429` with a **plain-text** body (`error code: 1015`), not JSON, and a `Retry-After` header in seconds.
  Check the status before calling `res.json()`, and wait `Retry-After` before retrying.
  ETag revalidations count toward the limit too, but a `304` has no body, so it's the cheapest request you can make.

```ts
// Handling 304 and 429 in JS
const res = await fetch(url, { headers: { 'If-None-Match': etag } });
if (res.status === 304) return cachedData;
if (res.status === 429) {
  const waitSeconds = Number(res.headers.get('Retry-After') ?? 10);
  // back off for waitSeconds, then retry
}
const data = await res.json();
```

## Data Source

Stats are sourced from the [Mario Kart World Statpedia](https://docs.google.com/spreadsheets/d/1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc/edit), created and maintained by **ItsManu001**, with major contributions from Chrop, Munskin and PartyMain, and testing and analysis by K1ngGr33n, HeWe015, Tuan, TotoShampoin, Katie, Bayzer, Jahordon, AprilShade, Naptec, kenbrisco97, Bento and theta_k. See the sheet's Credits tab for details.

Updates follow the Statpedia sheet; there is no fixed schedule. To import the latest version:

```bash
npm run fetch-data     # download the Statpedia tabs we use into scripts/csv/
npm run generate-data  # parse, validate, and write data/*.json (fails loudly if the sheet layout changed)
```

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

# Smoke test a running Worker (defaults to production)
SMOKE_BASE_URL=http://localhost:8787/mkw/api/v1 npm run smoke
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
