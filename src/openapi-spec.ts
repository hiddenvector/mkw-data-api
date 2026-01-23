/**
 * OpenAPI 3.1 Specification for Mario Kart World Data API
 *
 * This spec powers the interactive API documentation at /docs
 */

import { API_CONFIG } from "./config";

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Mario Kart World Data API',
    version: API_CONFIG.serviceVersion,
    description: `
Free, community-maintained data API for Mario Kart World stats, combos, and track information.

**Data Source:** [Mario Kart World Statpedia](https://docs.google.com/spreadsheets/d/1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc/edit)

**Features:**
- Terrain-specific stats (road, rough, water)
- Surface coverage data for all tracks
- Vehicle grouping by stat tags
- Versioned data with ETags for efficient caching

**Legal:** This is an unofficial, fan-created project. Not affiliated with Nintendo. Mario Kart is a registered trademark of Nintendo Co., Ltd.
    `.trim(),
    contact: {
      name: 'Hidden Vector Studio',
      url: 'https://hiddenvector.studio'
    },
    license: {
      name: 'CC-BY-4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/'
    }
  },
  servers: [
    {
      url: `https://hiddenvector.studio${API_CONFIG.basePath}`,
      description: 'Production'
    }
  ],
  tags: [
    {
      name: 'Health',
      description: 'API health and status'
    },
    {
      name: 'Characters',
      description: 'Playable characters and their stats'
    },
    {
      name: 'Vehicles',
      description: 'Karts, bikes, and ATVs with their stats'
    },
    {
      name: 'Tracks',
      description: 'Race tracks and surface coverage data'
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health Check',
        description: 'Returns API status, version, and current data version',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'ok'
                    },
                    version: {
                      type: 'string',
                      example: '1.0.0'
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2026-01-20T12:00:00Z'
                    },
                    dataVersion: {
                      type: 'string',
                      example: '2026-01-20',
                      description: 'Version of the game data (updated when Statpedia changes)'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/characters': {
      get: {
        tags: ['Characters'],
        summary: 'List All Characters',
        description: 'Returns all playable characters with their stats',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    dataVersion: {
                      type: 'string',
                      example: '2026-01-20'
                    },
                    characters: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Character' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/characters/{id}': {
      get: {
        tags: ['Characters'],
        summary: 'Get Character by ID',
        description: 'Returns a single character by their ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            examples: {
              dryBones: {
                value: 'dry-bones',
                summary: 'Example character ID'
              }
            },
            description: 'Character ID (slug format)'
          }
        ],
        responses: {
          '200': {
            description: 'Character found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Character' }
              }
            }
          },
          '404': {
            description: 'Character not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/vehicles': {
      get: {
        tags: ['Vehicles'],
        summary: 'List All Vehicles',
        description: 'Returns all vehicles (karts, bikes, ATVs) with their stats',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    dataVersion: {
                      type: 'string',
                      example: '2026-01-20'
                    },
                    vehicles: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Vehicle' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/vehicles/{id}': {
      get: {
        tags: ['Vehicles'],
        summary: 'Get Vehicle by ID',
        description: 'Returns a single vehicle by its ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            examples: {
              machRocket: {
                value: 'mach-rocket',
                summary: 'Example vehicle ID'
              }
            },
            description: 'Vehicle ID (slug format)'
          }
        ],
        responses: {
          '200': {
            description: 'Vehicle found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Vehicle' }
              }
            }
          },
          '404': {
            description: 'Vehicle not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/vehicles/tag/{tag}': {
      get: {
        tags: ['Vehicles'],
        summary: 'Get Vehicles by Tag',
        description: 'Returns all vehicles that share the same tag (identical stats)',
        parameters: [
          {
            name: 'tag',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            examples: {
              onL0: {
                value: 'on-l-0',
                summary: 'Example vehicle tag'
              }
            },
            description: 'Vehicle tag (groups vehicles with identical stats)'
          }
        ],
        responses: {
          '200': {
            description: 'Vehicles found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tag: {
                      type: 'string',
                      example: 'on-l-0'
                    },
                    dataVersion: {
                      type: 'string',
                      example: '2026-01-20'
                    },
                    vehicles: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Vehicle' }
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'No vehicles found with this tag',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/tracks': {
      get: {
        tags: ['Tracks'],
        summary: 'List All Tracks',
        description: 'Returns all race tracks with surface coverage data',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    dataVersion: {
                      type: 'string',
                      example: '2026-01-20'
                    },
                    tracks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Track' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/tracks/{id}': {
      get: {
        tags: ['Tracks'],
        summary: 'Get Track by ID',
        description: 'Returns a single track by its ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            examples: {
              marioBrosCircuit: {
                value: 'mario-bros-circuit',
                summary: 'Example track ID'
              }
            },
            description: 'Track ID (slug format)'
          }
        ],
        responses: {
          '200': {
            description: 'Track found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Track' }
              }
            }
          },
          '404': {
            description: 'Track not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/tracks/cup/{cup}': {
      get: {
        tags: ['Tracks'],
        summary: 'Get Tracks by Cup',
        description: 'Returns all tracks in a specific cup',
        parameters: [
          {
            name: 'cup',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            examples: {
              mushroomCup: {
                value: 'mushroom-cup',
                summary: 'Example cup name'
              }
            },
            description: 'Cup name (slug format, e.g., "mushroom-cup", "flower-cup")'
          }
        ],
        responses: {
          '200': {
            description: 'Tracks found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cup: {
                      type: 'string',
                      example: 'Mushroom Cup'
                    },
                    dataVersion: {
                      type: 'string',
                      example: '2026-01-20'
                    },
                    tracks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Track' }
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'No tracks found in this cup',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      TerrainStats: {
        type: 'object',
        description: 'Stats for different surface types',
        properties: {
          road: {
            type: 'number',
            description: 'Performance on paved surfaces (asphalt, concrete, bricks)',
            example: 7
          },
          rough: {
            type: 'number',
            description: 'Performance on coarse terrain (dirt, gravel, sand, snow, ice)',
            example: 2
          },
          water: {
            type: 'number',
            description: 'Performance on liquid surfaces (water, lava, chocolate)',
            example: 2
          }
        },
        required: ['road', 'rough', 'water']
      },
      Character: {
        type: 'object',
        description: 'A playable character with their stats',
        properties: {
          id: {
            type: 'string',
            example: 'dry-bones',
            description: 'Unique identifier (slug format)'
          },
          name: {
            type: 'string',
            example: 'Dry Bones',
            description: 'Character display name'
          },
          speed: {
            $ref: '#/components/schemas/TerrainStats',
            description: 'Speed stats by surface type'
          },
          handling: {
            $ref: '#/components/schemas/TerrainStats',
            description: 'Handling stats by surface type'
          },
          acceleration: {
            type: 'number',
            example: 6,
            description: 'How quickly the vehicle reaches max speed'
          },
          miniTurbo: {
            type: 'number',
            example: 3,
            description: 'Duration/power of mini-turbos, charge jumps, rail/wall jumps'
          },
          weight: {
            type: 'number',
            example: 1,
            description: 'Bumping power when colliding with other racers'
          },
          coinCurve: {
            type: 'number',
            example: 8,
            description: 'How coins affect speed (higher = more benefit from early coins)'
          }
        },
        required: ['id', 'name', 'speed', 'handling', 'acceleration', 'miniTurbo', 'weight', 'coinCurve']
      },
      Vehicle: {
        type: 'object',
        description: 'A vehicle (kart, bike, or ATV) with its stats',
        properties: {
          id: {
            type: 'string',
            example: 'mach-rocket',
            description: 'Unique identifier (slug format)'
          },
          name: {
            type: 'string',
            example: 'Mach Rocket',
            description: 'Vehicle display name'
          },
          tag: {
            type: 'string',
            example: 'on-l-0',
            description: 'Tag grouping vehicles with identical stats'
          },
          speed: {
            $ref: '#/components/schemas/TerrainStats'
          },
          handling: {
            $ref: '#/components/schemas/TerrainStats'
          },
          acceleration: {
            type: 'number',
            example: 7
          },
          miniTurbo: {
            type: 'number',
            example: 7
          },
          weight: {
            type: 'number',
            example: 0
          },
          coinCurve: {
            type: 'number',
            example: 6
          }
        },
        required: ['id', 'name', 'tag', 'speed', 'handling', 'acceleration', 'miniTurbo', 'weight', 'coinCurve']
      },
      SurfaceCoverage: {
        type: 'object',
        description: 'Surface coverage percentages for a track',
        properties: {
          road: {
            type: 'number',
            example: 47,
            description: 'Percentage of track on paved surfaces'
          },
          rough: {
            type: 'number',
            example: 15,
            description: 'Percentage of track on rough terrain'
          },
          water: {
            type: 'number',
            example: 0,
            description: 'Percentage of track on water'
          },
          neutral: {
            type: 'number',
            example: 34,
            description: 'Percentage of track on rails/walls/air (same speed for all)'
          },
          offRoad: {
            type: 'number',
            example: 4,
            description: 'Percentage of track on off-road penalty zones'
          }
        },
        required: ['road', 'rough', 'water', 'neutral', 'offRoad']
      },
      Track: {
        type: 'object',
        description: 'A race track with surface coverage data',
        properties: {
          id: {
            type: 'string',
            example: 'mario-bros-circuit',
            description: 'Unique identifier (slug format)'
          },
          name: {
            type: 'string',
            example: 'Mario Bros. Circuit',
            description: 'Track display name'
          },
          cup: {
            type: 'string',
            example: 'Mushroom Cup',
            description: 'The cup this track belongs to'
          },
          surfaceCoverage: {
            $ref: '#/components/schemas/SurfaceCoverage',
            description: 'Breakdown of surface types on this track'
          }
        },
        required: ['id', 'name', 'cup', 'surfaceCoverage']
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            example: 'Character \'invalid\' not found',
            description: 'Error message'
          }
        },
        required: ['error']
      }
    }
  }
};
