/**
 * Zod schemas for Mario Kart World Data API
 *
 * These schemas serve three purposes:
 * 1. Runtime validation of request parameters
 * 2. Auto-generation of OpenAPI specification
 * 3. TypeScript type inference
 */

import { z } from '@hono/zod-openapi';

// Examples in the OpenAPI spec are taken from the real data so they can't go stale.
import charactersData from '../data/characters.json';
import vehiclesData from '../data/vehicles.json';
import tracksData from '../data/tracks.json';

const exampleOf = <T extends { id: string }>(items: T[], id: string) =>
  items.find((item) => item.id === id);

// ============================================================================
// Validation Constants
// ============================================================================

/** Max length for entity IDs (characters, vehicles, tracks) */
const MAX_ID_LENGTH = 64;

/** Regex for valid entity IDs: lowercase alphanumeric with hyphens, no leading/trailing hyphens */
export const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Stat range for character/vehicle stats (0-20 covers all known values with headroom) */
const STAT_MIN = 0;
const STAT_MAX = 20;

/** Surface coverage percentages (0-100) */
const COVERAGE_MIN = 0;
const COVERAGE_MAX = 100;

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/** Base ID validation without example (reused across entity-specific schemas) */
const idSchema = z
  .string()
  .min(1)
  .max(MAX_ID_LENGTH)
  .regex(ID_PATTERN, 'ID must be lowercase alphanumeric with hyphens');

/** Character ID path parameter */
export const CharacterIdParamSchema = z.object({
  id: idSchema.openapi({
    param: { name: 'id', in: 'path' },
    example: 'dry-bones',
  }),
});

/** Vehicle ID path parameter */
export const VehicleIdParamSchema = z.object({
  id: idSchema.openapi({
    param: { name: 'id', in: 'path' },
    example: 'mach-rocket',
  }),
});

/** Track ID path parameter */
export const TrackIdParamSchema = z.object({
  id: idSchema.openapi({
    param: { name: 'id', in: 'path' },
    example: 'mario-bros-circuit',
  }),
});

const tagSchema = z
  .string()
  .min(1)
  .max(MAX_ID_LENGTH)
  .regex(ID_PATTERN, 'Tag must be lowercase alphanumeric with hyphens');

/** Vehicle tag query parameter */
export const TagQuerySchema = z.object({
  tag: tagSchema.optional().openapi({
    param: { name: 'tag', in: 'query' },
    example: 'on-l-2',
  }),
});

const cupSchema = z
  .string()
  .min(1)
  .max(MAX_ID_LENGTH)
  .regex(ID_PATTERN, 'Cup must be lowercase with hyphens');

/** Cup name query parameter */
export const CupQuerySchema = z.object({
  cup: cupSchema.optional().openapi({
    param: { name: 'cup', in: 'query' },
    example: 'mushroom-cup',
  }),
});

// ============================================================================
// Conditional Request Schemas
// ============================================================================

/** If-None-Match request header for ETag revalidation (keys are lowercase for Hono's validator). */
export const ConditionalRequestHeadersSchema = z.object({
  'if-none-match': z
    .string()
    .optional()
    .openapi({
      param: { name: 'if-none-match', in: 'header' },
      description: 'ETag from a previous response; returns 304 Not Modified if unchanged.',
      example: '"1.1.0-1x2y3z4w5v"',
    }),
});

/** ETag response header returned by all data endpoints. */
export const EtagResponseHeadersSchema = z.object({
  ETag: z.string().openapi({
    description: 'Opaque validator; changes whenever the data or service version changes.',
    example: '"1.1.0-1x2y3z4w5v"',
  }),
});

// ============================================================================
// Core Data Schemas
// ============================================================================

/**
 * Stats for the three surface types (used directly for handling).
 */
export const TerrainStatsSchema = z
  .object({
    road: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
      description: 'Performance on paved surfaces (asphalt, concrete, bricks). Higher is better.',
    }),
    rough: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
      description:
        'Performance on off-road terrain (dirt, gravel, sand, snow, ice), called "Off-Road" in the Statpedia. Higher is better.',
    }),
    water: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
      description: 'Performance on liquid surfaces (water, lava, chocolate). Higher is better.',
    }),
  })
  .openapi('TerrainStats');

/**
 * Speed stats: the three surface types plus gliding.
 */
export const SpeedStatsSchema = TerrainStatsSchema.extend({
  gliding: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description:
      'Speed while gliding (not cannon gliders, which set everyone to the same speed). Higher is better.',
  }),
}).openapi('SpeedStats');

/**
 * Core racing stats shared by characters and vehicles.
 */
export const BaseStatsSchema = z.object({
  speed: SpeedStatsSchema.openapi({ description: 'Speed stats by surface type, plus gliding' }),
  handling: TerrainStatsSchema.openapi({
    description: 'Handling stats by surface type (handling while gliding is the same for everyone)',
  }),
  acceleration: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'How quickly top speed is reached. Higher is better.',
  }),
  miniTurbo: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description:
      'Duration/power of mini-turbos and jump boosts (charge/rail/wall). Higher is better.',
  }),
  weight: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'Bumping power and resistance in collisions. Higher is heavier.',
  }),
  coinCurve: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'How strongly coins boost speed (higher = more benefit from early coins).',
  }),
  invincibility: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description:
      'Invincibility time after being hit by an item or hazard. Higher lasts longer (4 frames per level for a combo).',
  }),
});

/**
 * A playable character with their stats.
 * Example based on Dry Bones.
 */
export const CharacterSchema = BaseStatsSchema.extend({
  id: z.string().openapi({ description: 'Unique identifier (slug format)' }),
  name: z.string().openapi({ description: 'Character display name' }),
  size: z.string().openapi({ description: 'Frame size: Small, Medium, or Large' }),
  class: z.string().openapi({
    description: 'Weight class as named in the Statpedia (e.g. "Fly", "Cruiser", "Super Heavy")',
  }),
}).openapi('Character', {
  example: exampleOf(charactersData.characters, 'dry-bones'),
});

/**
 * A vehicle with its stats.
 * Example based on Mach Rocket.
 */
export const VehicleSchema = BaseStatsSchema.extend({
  id: z.string().openapi({ description: 'Unique identifier (slug format)' }),
  name: z.string().openapi({ description: 'Vehicle display name' }),
  tag: z.string().openapi({ description: 'Tag grouping vehicles with identical stats' }),
  class: z.string().openapi({
    description: 'Vehicle class as named in the Statpedia (e.g. "Light On-Roader", "Water Hybrid")',
  }),
}).openapi('Vehicle', {
  example: exampleOf(vehiclesData.vehicles, 'mach-rocket'),
});

/**
 * Surface coverage percentages for a track.
 */
export const SurfaceCoverageSchema = z
  .object({
    road: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on paved surfaces.',
    }),
    rough: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on off-road terrain (dirt, gravel, sand, snow, ice).',
    }),
    water: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on water.',
    }),
    gliding: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track spent gliding (not cannon gliders).',
    }),
    neutral: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description:
        'Percentage of track where speed is the same for everyone: heavy off-road, rails, walls, cannon gliders.',
    }),
    offRoad: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      deprecated: true,
      description:
        'Deprecated: always 0. The Statpedia now counts heavy off-road (penalty zones) as neutral.',
    }),
  })
  .openapi('SurfaceCoverage');

/**
 * Road/rough/water coverage only, rescaled to sum to 100 (excludes gliding and neutral).
 */
export const TerrainCoverageSchema = z
  .object({
    road: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Adjusted percentage of track on paved surfaces (normalized).',
    }),
    rough: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Adjusted percentage of track on rough terrain (normalized).',
    }),
    water: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Adjusted percentage of track on water (normalized).',
    }),
  })
  .openapi('TerrainCoverage');

/**
 * A race track with surface coverage data.
 * Example based on Mario Bros. Circuit.
 */
export const TrackSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique identifier (slug format)' }),
    name: z.string().openapi({ description: 'Track display name' }),
    cup: z.string().openapi({ description: 'Display name of the cup this track belongs to' }),
    cupId: z
      .string()
      .openapi({ description: 'Slug of the cup this track belongs to (use with ?cup=)' }),
    surfaceCoverage: SurfaceCoverageSchema.openapi({
      description: 'Full surface breakdown (sums to ~100), including gliding and neutral.',
    }),
    terrainCoverage: TerrainCoverageSchema.openapi({
      description:
        'Road/rough/water mix rescaled to exactly 100, for weighting per-surface stats. Add gliding from surfaceCoverage for speed if needed.',
    }),
  })
  .openapi('Track', {
    example: exampleOf(tracksData.tracks, 'mario-bros-circuit'),
  });

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Data version string (YYYY-MM-DD format).
 */
const DataVersionSchema = z.string().openapi({
  description: 'Version of the game data (updated when Statpedia changes)',
  example: '2026-01-23',
});

/**
 * Response containing all characters.
 * Example shows the first 3 characters.
 */
export const CharactersResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    characters: z.array(CharacterSchema),
  })
  .openapi('CharactersResponse', {
    example: {
      dataVersion: charactersData.dataVersion,
      characters: charactersData.characters.slice(0, 3),
    },
  });

/**
 * Response containing all vehicles.
 * Example shows the first 3 vehicles.
 */
export const VehiclesResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    vehicles: z.array(VehicleSchema),
  })
  .openapi('VehiclesResponse', {
    example: {
      dataVersion: vehiclesData.dataVersion,
      vehicles: vehiclesData.vehicles.slice(0, 3),
    },
  });

/**
 * Response containing all tracks.
 * Example shows the first 3 tracks.
 */
export const TracksResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    tracks: z.array(TrackSchema),
  })
  .openapi('TracksResponse', {
    example: {
      dataVersion: tracksData.dataVersion,
      tracks: tracksData.tracks.slice(0, 3),
    },
  });

/**
 * Health check response.
 */
export const HealthResponseSchema = z
  .object({
    status: z.literal('ok').openapi({ description: 'API health status' }),
    apiVersion: z.string().openapi({ description: 'API version (e.g., "v1")' }),
    serviceVersion: z.string().openapi({ description: 'Service version from package.json' }),
    timestamp: z
      .string()
      .datetime()
      .openapi({ description: 'Current server time in ISO 8601 format' }),
    dataVersion: DataVersionSchema,
    dataLoaded: z
      .object({
        characters: z.number().int().openapi({ description: 'Number of loaded characters' }),
        vehicles: z.number().int().openapi({ description: 'Number of loaded vehicles' }),
        tracks: z.number().int().openapi({ description: 'Number of loaded tracks' }),
      })
      .openapi({ description: 'Count of loaded data items' }),
  })
  .openapi('HealthResponse', {
    example: {
      status: 'ok',
      apiVersion: 'v1',
      serviceVersion: '1.0.0',
      timestamp: '2026-01-23T12:00:00.000Z',
      dataVersion: '2026-01-23',
      dataLoaded: {
        characters: 50,
        vehicles: 40,
        tracks: 30,
      },
    },
  });

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type TerrainStats = z.infer<typeof TerrainStatsSchema>;
export type SpeedStats = z.infer<typeof SpeedStatsSchema>;
export type BaseStats = z.infer<typeof BaseStatsSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Vehicle = z.infer<typeof VehicleSchema>;
export type SurfaceCoverage = z.infer<typeof SurfaceCoverageSchema>;
export type TerrainCoverage = z.infer<typeof TerrainCoverageSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type CharactersResponse = z.infer<typeof CharactersResponseSchema>;
export type VehiclesResponse = z.infer<typeof VehiclesResponseSchema>;
export type TracksResponse = z.infer<typeof TracksResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
