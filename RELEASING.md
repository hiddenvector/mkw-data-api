# Releasing

Release checklist for production tags.

## Release checklist

1. Update data (if needed)

    - If data changed, update `src/data-version.ts` and `data/*.json` via `npm run generate-data`.

2. Update docs

    - Add entries to `CHANGELOG.md` under `[Unreleased]`.
    - Move `[Unreleased]` notes into a dated release section.

3. Validate

    - Run `npm run typecheck`.
    - Run `npm test`.
    - Run `npm run lint`.

4. Tag and release

    - Bump and tag with `npm version patch|minor|major` (updates `package.json` and creates `vX.Y.Z`).
    - Publish a GitHub release from the tag with notes from `CHANGELOG.md`.
    - Push with `git push --follow-tags`.

5. Deploy and verify

    - Deploy with `npm run deploy`.
    - Verify `/health`, `/openapi.json`, and key endpoints in production.

## Versioning guide

- **PATCH**: fixes, metadata updates, or data-only changes (data-only releases still require a patch bump + tag for deploy).
- **MINOR**: new endpoints or backward-compatible schema additions.
- **MAJOR**: breaking changes and a new base path (`/v2`, `/v3`, ...).
