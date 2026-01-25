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

/** Vehicle tag path parameter */
export const TagParamSchema = z.object({
  tag: z
    .string()
    .min(1)
    .max(MAX_ID_LENGTH)
    .regex(ID_PATTERN, 'Tag must be lowercase alphanumeric with hyphens')
    .openapi({
      param: { name: 'tag', in: 'path' },
      example: 'on-l-0',
    }),
});

/** Cup name path parameter */
export const CupParamSchema = z.object({
  cup: z
    .string()
    .min(1)
    .max(MAX_ID_LENGTH)
    .regex(ID_PATTERN, 'Cup must be lowercase with hyphens')
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
    }),
    rough: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
      description: 'Performance on coarse terrain (dirt, gravel, sand, snow, ice)',
    }),
    water: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
      description: 'Performance on liquid surfaces (water, lava, chocolate)',
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
  }),
  miniTurbo: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'Duration/power of mini-turbos, charge jumps, rail/wall jumps',
  }),
  weight: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'Bumping power when colliding with other racers',
  }),
  coinCurve: z.number().int().min(STAT_MIN).max(STAT_MAX).openapi({
    description: 'How coins affect speed (higher = more benefit from early coins)',
  }),
});

/**
 * A playable character with their stats.
 * Example based on Dry Bones.
 */
export const CharacterSchema = BaseStatsSchema.extend({
  id: z.string().openapi({ description: 'Unique identifier (slug format)' }),
  name: z.string().openapi({ description: 'Character display name' }),
}).openapi(
  'Character',
  {
    example: {
      id: 'dry-bones',
      name: 'Dry Bones',
      speed: { road: 0, rough: 1, water: 0 },
      handling: { road: 5, rough: 7, water: 5 },
      acceleration: 6,
      miniTurbo: 3,
      weight: 1,
      coinCurve: 8,
    },
  }
);

/**
 * A vehicle with its stats.
 * Example based on Mach Rocket.
 */
export const VehicleSchema = BaseStatsSchema.extend({
  id: z.string().openapi({ description: 'Unique identifier (slug format)' }),
  name: z.string().openapi({ description: 'Vehicle display name' }),
  tag: z.string().openapi({ description: 'Tag grouping vehicles with identical stats' }),
}).openapi(
  'Vehicle',
  {
    example: {
      id: 'mach-rocket',
      name: 'Mach Rocket',
      tag: 'on-l-0',
      speed: { road: 6, rough: 1, water: 1 },
      handling: { road: 11, rough: 7, water: 7 },
      acceleration: 7,
      miniTurbo: 7,
      weight: 0,
      coinCurve: 6,
    },
  }
);

/**
 * Surface coverage percentages for a track.
 */
export const SurfaceCoverageSchema = z
  .object({
    road: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on paved surfaces',
    }),
    rough: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on rough terrain',
    }),
    water: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on water',
    }),
    neutral: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on rails/walls/air (same speed for all)',
    }),
    offRoad: z.number().min(COVERAGE_MIN).max(COVERAGE_MAX).openapi({
      description: 'Percentage of track on off-road penalty zones',
    }),
  })
  .openapi('SurfaceCoverage');

/**
 * A race track with surface coverage data.
 * Example based on Mario Bros. Circuit.
 */
export const TrackSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique identifier (slug format)' }),
    name: z.string().openapi({ description: 'Track display name' }),
    cup: z.string().openapi({ description: 'The cup this track belongs to' }),
    surfaceCoverage: SurfaceCoverageSchema.openapi({
      description: 'Breakdown of surface types on this track',
    }),
  })
  .openapi(
    'Track',
    {
      example: {
        id: 'mario-bros-circuit',
        name: 'Mario Bros. Circuit',
        cup: 'Mushroom Cup',
        surfaceCoverage: { road: 47, rough: 15, water: 0, neutral: 34, offRoad: 4 },
      },
    }
  );

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
 * Example shows first 3 characters (full response contains 50).
 */
export const CharactersResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    characters: z.array(CharacterSchema),
  })
  .openapi(
    'CharactersResponse',
    {
      example: {
        dataVersion: '2026-01-23',
        characters: [
          {
            id: 'baby-peach',
            name: 'Baby Peach',
            speed: { road: 0, rough: 0, water: 0 },
            handling: { road: 6, rough: 6, water: 6 },
            acceleration: 7,
            miniTurbo: 4,
            weight: 0,
            coinCurve: 9,
          },
          {
            id: 'baby-daisy',
            name: 'Baby Daisy',
            speed: { road: 0, rough: 0, water: 0 },
            handling: { road: 6, rough: 6, water: 6 },
            acceleration: 7,
            miniTurbo: 4,
            weight: 0,
            coinCurve: 9,
          },
          {
            id: 'dry-bones',
            name: 'Dry Bones',
            speed: { road: 0, rough: 1, water: 0 },
            handling: { road: 5, rough: 7, water: 5 },
            acceleration: 6,
            miniTurbo: 3,
            weight: 1,
            coinCurve: 8,
          },
        ],
      },
    }
  );

/**
 * Response containing all vehicles.
 * Example shows first 3 vehicles (full response contains 40).
 */
export const VehiclesResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    vehicles: z.array(VehicleSchema),
  })
  .openapi(
    'VehiclesResponse',
    {
      example: {
        dataVersion: '2026-01-23',
        vehicles: [
          {
            id: 'standard-bike',
            name: 'Standard Bike',
            tag: 'st-a-0',
            speed: { road: 1, rough: 1, water: 1 },
            handling: { road: 8, rough: 8, water: 8 },
            acceleration: 9,
            miniTurbo: 9,
            weight: 0,
            coinCurve: 6,
          },
          {
            id: 'tune-thumper',
            name: 'Tune Thumper',
            tag: 'st-a-0',
            speed: { road: 1, rough: 1, water: 1 },
            handling: { road: 8, rough: 8, water: 8 },
            acceleration: 9,
            miniTurbo: 9,
            weight: 0,
            coinCurve: 6,
          },
          {
            id: 'mach-rocket',
            name: 'Mach Rocket',
            tag: 'on-l-0',
            speed: { road: 6, rough: 1, water: 1 },
            handling: { road: 11, rough: 7, water: 7 },
            acceleration: 7,
            miniTurbo: 7,
            weight: 0,
            coinCurve: 6,
          },
        ],
      },
    }
  );

/**
 * Response containing vehicles filtered by tag.
 * Example shows both vehicles that share the on-l-0 tag.
 */
export const VehiclesByTagResponseSchema = z
  .object({
    tag: z.string().openapi({ description: 'The tag that groups these vehicles' }),
    dataVersion: DataVersionSchema,
    vehicles: z.array(VehicleSchema),
  })
  .openapi(
    'VehiclesByTagResponse',
    {
      example: {
        tag: 'on-l-0',
        dataVersion: '2026-01-23',
        vehicles: [
          {
            id: 'mach-rocket',
            name: 'Mach Rocket',
            tag: 'on-l-0',
            speed: { road: 6, rough: 1, water: 1 },
            handling: { road: 11, rough: 7, water: 7 },
            acceleration: 7,
            miniTurbo: 7,
            weight: 0,
            coinCurve: 6,
          },
          {
            id: 'rob-hog',
            name: 'R.O.B. H.O.G.',
            tag: 'on-l-0',
            speed: { road: 6, rough: 1, water: 1 },
            handling: { road: 11, rough: 7, water: 7 },
            acceleration: 7,
            miniTurbo: 7,
            weight: 0,
            coinCurve: 6,
          },
        ],
      },
    }
  );

/**
 * Response containing all tracks.
 * Example shows first 3 tracks (full response contains 30).
 */
export const TracksResponseSchema = z
  .object({
    dataVersion: DataVersionSchema,
    tracks: z.array(TrackSchema),
  })
  .openapi(
    'TracksResponse',
    {
      example: {
        dataVersion: '2026-01-23',
        tracks: [
          {
            id: 'mario-bros-circuit',
            name: 'Mario Bros. Circuit',
            cup: 'Mushroom Cup',
            surfaceCoverage: { road: 47, rough: 15, water: 0, neutral: 34, offRoad: 4 },
          },
          {
            id: 'crown-city',
            name: 'Crown City',
            cup: 'Mushroom Cup',
            surfaceCoverage: { road: 78, rough: 0, water: 0, neutral: 20, offRoad: 2 },
          },
          {
            id: 'whistlestop-summit',
            name: 'Whistlestop Summit',
            cup: 'Mushroom Cup',
            surfaceCoverage: { road: 35, rough: 0, water: 0, neutral: 62, offRoad: 3 },
          },
        ],
      },
    }
  );

/**
 * Response containing tracks filtered by cup.
 * Example shows all 4 tracks in the Mushroom Cup.
 */
export const TracksByCupResponseSchema = z
  .object({
    cup: z.string().openapi({ description: 'The cup name these tracks belong to' }),
    dataVersion: DataVersionSchema,
    tracks: z.array(TrackSchema),
  })
  .openapi(
    'TracksByCupResponse',
    {
      example: {
        cup: 'Mushroom Cup',
        dataVersion: '2026-01-23',
        tracks: [
          {
            id: 'mario-bros-circuit',
            name: 'Mario Bros. Circuit',
            cup: 'Mushroom Cup',
            surfaceCoverage: { road: 47, rough: 15, water: 0, neutral: 34, offRoad: 4 },
          },
          {
            id: 'crown-city',
            name: 'Crown City',
            cup: 'Mushroom Cup',
            surfaceCoverage: { road: 78, rough: 0, water: 0, neutral: 20, offRoad: 2 },
          },
          {
            id: 'whistlestop-summit',
            name: 'Whistlestop Summit',
            cup: 'Mushroom Cup',
            surfaceCoverage: { road: 35, rough: 0, water: 0, neutral: 62, offRoad: 3 },
          },
          {
            id: 'dk-spaceport',
            name: 'DK Spaceport',
            cup: 'Mushroom Cup',
            surfaceCoverage: { road: 79, rough: 0, water: 0, neutral: 17, offRoad: 4 },
          },
        ],
      },
    }
  );

/**
 * Health check response.
 */
export const HealthResponseSchema = z
  .object({
    status: z.literal('ok').openapi({ description: 'API health status' }),
    apiVersion: z.string().openapi({ description: 'API version (e.g., "v1")' }),
    serviceVersion: z.string().openapi({ description: 'Service version from package.json' }),
    timestamp: z.string().datetime().openapi({ description: 'Current server time in ISO 8601 format' }),
    dataVersion: DataVersionSchema,
    dataLoaded: z
      .object({
        characters: z.number().int().openapi({ description: 'Number of loaded characters' }),
        vehicles: z.number().int().openapi({ description: 'Number of loaded vehicles' }),
        tracks: z.number().int().openapi({ description: 'Number of loaded tracks' }),
      })
      .openapi({ description: 'Count of loaded data items' }),
  })
  .openapi(
    'HealthResponse',
    {
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
    }
  );

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
