# Releasing

Release checklist for production tags. Pushing a `vX.Y.Z` tag deploys automatically
(`.github/workflows/deploy.yml`); do not run `npm run deploy` by hand.

## Release checklist

1. Update data (if needed)
   - Replace the CSVs in `scripts/csv/` with fresh Statpedia exports.
   - Run `npm run generate-data`. It fails loudly on malformed rows, unmapped tracks
     (add them to `CUP_MAPPING`), or schema violations.
   - `dataVersion` is bumped to today only if the generated output changed.
     Set `DATA_VERSION=YYYY-MM-DD` to force a specific value.

2. Update docs
   - Add entries to `CHANGELOG.md` under `[Unreleased]`.

3. Validate
   - Run `npm run check` (format, typecheck, lint, tests).

4. Version and tag
   - Move the `[Unreleased]` entries in `CHANGELOG.md` under the new version heading and commit.
   - Run `npm version patch|minor|major` on `main` (updates `package.json` and creates the `vX.Y.Z` tag).
   - Push with `git push --follow-tags`.

5. Deploy and verify
   - The tag push runs CI, checks that the tag matches `package.json` and is on `main`, then deploys.
   - Verify `/health` (`serviceVersion`, `dataVersion`), `/openapi.json`, and key endpoints in production.
   - Publish a GitHub release from the tag with notes from `CHANGELOG.md`.

## Versioning guide

- **PATCH**: fixes, metadata updates, or data-only changes (data-only releases still require a patch bump + tag for deploy).
- **MINOR**: new endpoints or backward-compatible schema additions.
- **MAJOR**: breaking changes and a new base path (`/v2`, `/v3`, ...).

The service version is part of every `ETag`, so each release invalidates cached responses.
