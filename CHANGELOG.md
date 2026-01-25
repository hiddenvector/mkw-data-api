# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
