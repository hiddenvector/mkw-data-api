# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.2.0] - 2026-09-24

Data re-imported from the Statpedia (sheet last updated 2026-09-13), which reflects game updates 1.6.0 and 1.7.0.

### Added

- `speed.gliding` on characters and vehicles (Gliding Speed, game update 1.7.0).
- `invincibility` on characters and vehicles (game update 1.6.0).
- `size` and `class` on characters (e.g. `Small`, `Feather`); `class` on vehicles (e.g. `Light On-Roader`).
- `surfaceCoverage.gliding` on tracks.
- `npm run fetch-data` downloads the Statpedia tabs directly; the generator checks the sheet's column headers and fails if the layout changes.
- Statpedia credits in the README and API description.
- OpenAPI documents the edge `429` response (plain-text body, `Retry-After` header) on every route.
- Post-deploy smoke test (`npm run smoke`), run against production after every deploy and against a local Worker in CI.

### Changed

- **Vehicle tags renamed** to match the Statpedia (same groupings): `st-a-0`→`st-a-2`, `st-a-1`→`st-a-4`, `st-b-0`→`st-b-2`, `st-b-1`→`st-b-4`, `st-b-x`→`st-b-3`, `st-c-0`→`st-c-2`, `st-c-1`→`st-c-4`, `st-c-x`→`st-c-3`, `on-l-0`→`on-l-2`, `on-l-1`→`on-l-4`, `on-m`→`on-m-4`, `on-h-1`→`on-h-4`, `on-h-x`→`on-h-3`, `of-l-0`→`of-l-2`, `of-l-1`→`of-l-4`, `of-m`→`of-m-4`, `of-h`→`of-h-4`, `wt-l`→`wt-l-2`, `wt-m-1`→`wt-m-4`, `wt-m-x`→`wt-m-3`, `wt-h-1`→`wt-h-4`, `wt-h-x`→`wt-h-3`. `hb-of` and `hb-wt` are unchanged.
- Track surface coverage re-measured by the Statpedia (updated 2026-09-12). `neutral` now also covers heavy off-road.
- `terrainCoverage` is computed from `surfaceCoverage` road/rough/water with 2-decimal precision (previously from whole-percent adjusted columns), e.g. Mario Bros. Circuit is now 75.81/24.19/0 instead of 76/24/0.
- OpenAPI examples are generated from the live data.

### Deprecated

- `surfaceCoverage.offRoad` is always `0`: the Statpedia no longer measures off-road penalty zones separately and counts them as `neutral`.

## [1.1.0] - 2026-09-24

### Added

- `cupId` on tracks (e.g. `mushroom-cup`); `?cup=` matches it directly.
- `ETag` / `If-None-Match` support on single-item endpoints.
- OpenAPI now documents the `If-None-Match` request header and `ETag` response header.

### Changed

- `ETag`s are now a hash of the response data plus the service version (previously `dataVersion`),
  so same-day data changes and code releases invalidate caches correctly. Treat ETags as opaque.
- Error responses (4xx/5xx) are sent with `Cache-Control: no-store` instead of being cached for an hour.
- `/health` uses `Cache-Control: no-store`.
- 304 responses include `Cache-Control`.
- `terrainCoverage` values always sum to exactly 100 (largest-remainder rounding).
- Upstream `X-Request-ID` values are only echoed if they are ≤128 safe characters; otherwise a new ID is generated.
- The 404 `availableEndpoints` list is derived from registered routes (now includes `/openapi.json` and `/docs`).
- `/docs` loads a pinned Scalar version, and its CSP allows only that script.
- Data generator fails on malformed or incomplete source rows instead of warning, validates output
  against the API schemas, and only bumps `dataVersion` when output changes.
- Worker is served only via the zone route (`workers_dev = false`, `preview_urls = false`).
- Tooling: Node 24, TypeScript 6.0, ESLint 10, Vitest 5, Wrangler 4.137, current Hono/Zod;
  lint and typecheck now cover all sources; formatting enforced in CI; Dependabot enabled.
- Deploys run the full CI suite first, require the tag to be on `main`, and no longer use a third-party action.

### Removed

- Unused error helpers and `INVALID_ID` / `INVALID_TAG` / `INVALID_CUP` codes (never emitted by the API).

## [1.0.0] - 2026-01-26

- Stabilize API surface for `/v1` and document data contract and coverage semantics.
- Add query filtering on `/vehicles?tag=` and `/tracks?cup=` (empty list on no matches).
- Add `terrainCoverage` for tracks and US name normalization in the parser.
- Strengthen validation and error handling, plus full test coverage and CI guardrails.

## [2026-01-25]

- Standardize character names to US versions (`Swoop`, `Fish Bone`).
- Add `terrainCoverage` (adjusted road/rough/water coverage) to track responses.
- Replace `/vehicles/tag/{tag}` and `/tracks/cup/{cup}` with query filters on `/vehicles` and `/tracks`.
- Normalize the "Great ? Block Ruins" track ID to `great-question-block-ruins`.
- Validate data files on startup (IDs, tags, and dataVersion).
- Add Prettier configuration and formatting scripts.
- Fix cup normalization logic for `/tracks/cup/{cup}`.
- Allow `X-Request-ID` through CORS for client tracing.

## [2026-01-23]

- Initial release candidate of the Mario Kart World Data API.
