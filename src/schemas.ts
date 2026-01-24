/**
 * Zod schemas for Mario Kart World Data API
 *
 * These schemas serve three purposes:
 * 1. Runtime validation of request parameters
 * 2. Auto-generation of OpenAPI specification
 * 3. TypeScript type inference (can replace types.ts)
 */

import { z } from '@hono/zod-openapi';

// ============================================================================
// Validation Constants
// ============================================================================

/** Max length for entity IDs (characters, vehicles, tracks) */
const MAX_ID_LENGTH = 64;

/** Regex for valid entity IDs: lowercase alphanumeric with hyphens, no leading/trailing hyphens */
const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Stat range for character/vehicle stats (0-20 covers all known values with headroom) */
const STAT_MIN = 0;
const STAT_MAX = 20;

/** Surface coverage percentages (0-100) */
const COVERAGE_MIN = 0;
const COVERAGE_MAX = 100;

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * Schema for entity ID path parameters.
 * Used for /characters/:id, /vehicles/:id, /tracks/:id
 */
export const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(MAX_ID_LENGTH)
    .regex(ID_PATTERN, 'ID must be lowercase alphanumeric with hyphens (e.g., "dry-bones")')
    .openapi({
      param: { name: 'id', in: 'path' },
      example: 'dry-bones',
    }),
});

/**
 * Schema for vehicle tag path parameters.
 * Tags follow same format as IDs.
 */
export const TagParamSchema = z.object({
  tag: z
    .string()
    .min(1)
    .max(MAX_ID_LENGTH)
    .regex(ID_PATTERN, 'Tag must be lowercase alphanumeric with hyphens (e.g., "on-l-0")')
    .openapi({
      param: { name: 'tag', in: 'path' },
      example: 'on-l-0',
    }),
});

/**
 * Schema for cup name path parameters.
 * Cups use same format as IDs.
 */
export const CupParamSchema = z.object({
  cup: z
    .string()
    .min(1)
    .max(MAX_ID_LENGTH)
    .regex(ID_PATTERN, 'Cup must be lowercase with hyphens (e.g., "mushroom-cup")')
    .openapi({
      param: { name: 'cup', in: 'path' },
      example: 'mushroom-cup',
    }),
});

// ============================================================================
// Core Data Schemas
// ============================================================================

/**
 * Speed and handling stats for different surface types.
 */
export const TerrainStatsSchema = z
  .object({
    road: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
      description: 'Performance on paved surfaces (asphalt, concrete, bricks)',
      example: 7,
    }),
    rough: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
      description: 'Performance on coarse terrain (dirt, gravel, sand, snow, ice)',
      example: 2,
    }),
    water: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
      description: 'Performance on liquid surfaces (water, lava, chocolate)',
      example: 2,
    }),
  })
  .openapi('TerrainStats');

/**
 * Core racing stats shared by characters and vehicles.
 */
export const BaseStatsSchema = z.object({
  speed: TerrainStatsSchema.openapi({ description: 'Speed stats by surface type' }),
  handling: TerrainStatsSchema.openapi({ description: 'Handling stats by surface type' }),
  acceleration: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'How quickly the vehicle reaches max speed',
    example: 6,
  }),
  miniTurbo: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'Duration/power of mini-turbos, charge jumps, rail/wall jumps',
    example: 3,
  }),
  weight: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'Bumping power when colliding with other racers',
    example: 1,
  }),
  coinCurve: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'How coins affect speed (higher = more benefit from early coins)',
    example: 8,
  }),
});

/**
 * A playable character with their stats.
 */
export const CharacterSchema = BaseStatsSchema.extend({
  id: z.string().openapi({
    description: 'Unique identifier (slug format)',
    example: 'dry-bones',
  }),
  name: z.string().openapi({
    description: 'Character display name',
    example: 'Dry Bones',
  }),
}).openapi('Character');

/**
 * A vehicle (kart, bike, or ATV) with its stats.
 */
export const VehicleSchema = BaseStatsSchema.extend({
  id: z.string().openapi({
    description: 'Unique identifier (slug format)',
    example: 'mach-rocket',
  }),
  name: z.string().openapi({
    description: 'Vehicle display name',
    example: 'Mach Rocket',
  }),
  tag: z.string().openapi({
    description: 'Tag grouping vehicles with identical stats',
    example: 'on-l-0',
  }),
}).openapi('Vehicle');

/**
 * Surface coverage percentages for a track.
 */
export const SurfaceCoverageSchema = z
  .object({
    road: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on paved surfaces',
      example: 47,
    }),
    rough: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on rough terrain',
      example: 15,
    }),
    water: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on water',
      example: 0,
    }),
    neutral: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on rails/walls/air (same speed for all)',
      example: 34,
    }),
    offRoad: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on off-road penalty zones',
      example: 4,
    }),
  })
  .openapi('SurfaceCoverage');

/**
 * A race track with surface coverage data.
 */
export const TrackSchema = z
  .object({
    id: z.string().openapi({
      description: 'Unique identifier (slug format)',
      example: 'mario-bros-circuit',
    }),
    name: z.string().openapi({
      description: 'Track display name',
      example: 'Mario Bros. Circuit',
    }),
    cup: z.string().openapi({
      description: 'The cup this track belongs to',
      example: 'Mushroom Cup',
    }),
    surfaceCoverage: SurfaceCoverageSchema.openapi({
      description: 'Breakdown of surface types on this track',
    }),
  })
  .openapi('Track');

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Data version string (YYYY-MM-DD format).
 */
const DataVersionSchema = z.string().openapi({
  description: 'Version of the game data (updated when Statpedia changes)',
  example: '2026-01-20',
});

/**
 * Response containing all characters.
 */
export const CharactersResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    characters: z.array(CharacterSchema),
  })
  .openapi('CharactersResponse');

/**
 * Response containing all vehicles.
 */
export const VehiclesResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    vehicles: z.array(VehicleSchema),
  })
  .openapi('VehiclesResponse');

/**
 * Response containing vehicles filtered by tag.
 */
export const VehiclesByTagResponseSchema = z
  .object({
    tag: z.string().openapi({ example: 'on-l-0' }),
    dataVersion: DataVersionSchema,
    vehicles: z.array(VehicleSchema),
  })
  .openapi('VehiclesByTagResponse');

/**
 * Response containing all tracks.
 */
export const TracksResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    tracks: z.array(TrackSchema),
  })
  .openapi('TracksResponse');

/**
 * Response containing tracks filtered by cup.
 */
export const TracksByCupResponseSchema = z
  .object({
    cup: z.string().openapi({ example: 'Mushroom Cup' }),
    dataVersion: DataVersionSchema,
    tracks: z.array(TrackSchema),
  })
  .openapi('TracksByCupResponse');

/**
 * Health check response.
 */
export const HealthResponseSchema = z
  .object({
    status: z.literal('ok').openapi({ example: 'ok' }),
    apiVersion: z.string().openapi({
      description: 'API version (e.g., "v1")',
      example: 'v1',
    }),
    serviceVersion: z.string().openapi({
      description: 'Service version from package.json',
      example: '1.0.0',
    }),
    timestamp: z.string().datetime().openapi({
      description: 'Current server time in ISO 8601 format',
      example: '2026-01-20T12:00:00.000Z',
    }),
    dataVersion: DataVersionSchema,
    dataLoaded: z
      .object({
        characters: z.number().int().openapi({ example: 30 }),
        vehicles: z.number().int().openapi({ example: 80 }),
        tracks: z.number().int().openapi({ example: 32 }),
      })
      .openapi({ description: 'Count of loaded data items' }),
  })
  .openapi('HealthResponse');

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

export type TerrainStats = z.infer<typeof TerrainStatsSchema>;
export type BaseStats = z.infer<typeof BaseStatsSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Vehicle = z.infer<typeof VehicleSchema>;
export type SurfaceCoverage = z.infer<typeof SurfaceCoverageSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type CharactersResponse = z.infer<typeof CharactersResponseSchema>;
export type VehiclesResponse = z.infer<typeof VehiclesResponseSchema>;
export type TracksResponse = z.infer<typeof TracksResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
