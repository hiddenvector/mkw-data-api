# Mario Kart World Data API

Community-maintained REST API for character stats, vehicle data, and track information from Mario Kart World.

**Base URL:** `https://hiddenvector.studio/mkw/api/v1`

**Documentation:** [Interactive API Docs](https://hiddenvector.studio/mkw/api/v1/docs)

## Features

- **50 playable characters** with terrain-specific stats (road, rough, water)
- **40 vehicles** with stat tags for easy grouping
- **30 tracks** with surface coverage percentages
- ETag/If-None-Match support for efficient caching
- OpenAPI 3.1 spec with interactive documentation

## Quick Start

```bash
# Get all characters
curl https://hiddenvector.studio/mkw/api/v1/characters

# Get a specific character
curl https://hiddenvector.studio/mkw/api/v1/characters/dry-bones

# Get all vehicles
curl https://hiddenvector.studio/mkw/api/v1/vehicles

# Get vehicles by stat tag
curl https://hiddenvector.studio/mkw/api/v1/vehicles/tag/st-a-0

# Get all tracks
curl https://hiddenvector.studio/mkw/api/v1/tracks

# Get tracks by cup
curl https://hiddenvector.studio/mkw/api/v1/tracks/cup/mushroom-cup
```

## Endpoints

| Endpoint                  | Description                   |
| ------------------------- | ----------------------------- |
| `GET /health`             | API health and version info   |
| `GET /characters`         | List all characters           |
| `GET /characters/{id}`    | Get character by ID           |
| `GET /vehicles`           | List all vehicles             |
| `GET /vehicles/{id}`      | Get vehicle by ID             |
| `GET /vehicles/tag/{tag}` | Get vehicles by stat tag      |
| `GET /tracks`             | List all tracks               |
| `GET /tracks/{id}`        | Get track by ID               |
| `GET /tracks/cup/{cup}`   | Get tracks by cup             |
| `GET /openapi.json`       | OpenAPI 3.1 specification     |
| `GET /docs`               | Interactive API documentation |

## Caching

Collection endpoints (`/characters`, `/vehicles`, `/tracks`) return an `ETag` header based on the data version. Use `If-None-Match` to get a `304 Not Modified` response when data hasn't changed:

```bash
# First request - get the ETag
curl -I https://hiddenvector.studio/mkw/api/v1/characters
# ETag: "2026-01-25"

# Subsequent request - use If-None-Match
curl -I -H 'If-None-Match: "2026-01-25"' https://hiddenvector.studio/mkw/api/v1/characters
# HTTP/2 304
```

## Rate Limits

Requests may be rate limited by Cloudflare edge rules and return HTTP 429.

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

## Versioning & Releases (Pre-1.0 Policy)

The API is not yet at 1.0.0. We still use semantic versioning internally, but treat all changes as potentially unstable until the public 1.0 release.

**Current approach:**

- `package.json` version tracks the **service version** (runtime/code changes).
- `dataVersion` tracks **Statpedia data updates** and does not necessarily imply a service version bump.
- `/v1` is the **API major** and will remain until a breaking change requires `/v2`.

**Rules:**

- **PATCH**: internal fixes, performance, docs, or data-only updates.
- **MINOR**: new endpoints or backward-compatible schema additions.
- **MAJOR**: breaking changes and a new base path (`/v2`, `/v3`, ...).

**Releases:**

- Tag releases as `vX.Y.Z` matching `package.json`.
- Publish GitHub releases from tags and summarize changes from `CHANGELOG.md`.
- See `RELEASING.md` for the release checklist.

## Roadmap

- [ ] Combo calculator endpoint for optimal character + vehicle combinations
- [ ] Query parameter filtering (e.g., `/characters?minSpeed=5`)
- [ ] Track recommendations based on character/vehicle stats

## License

Code is licensed under [MIT](LICENSE). Data is provided under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

---

**Not affiliated with Nintendo. Mario Kart is a trademark of Nintendo Co., Ltd.**
