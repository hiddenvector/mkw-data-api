# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- OpenAPI documents the edge `429` response (plain-text body, `Retry-After` header) on every route.
- Post-deploy smoke test (`npm run smoke`), run against production after every deploy and against a local Worker in CI.

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
