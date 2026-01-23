/**
 * Speed and handling stats for different surface types.
 * Based on Mario Kart World Statpedia terminology.
 */
export interface TerrainStats {
    /** Performance on paved surfaces (asphalt, concrete, bricks) */
    readonly road: number;
    /** Performance on coarse surfaces (dirt, gravel, sand, snow, ice) */
    readonly rough: number;
    /** Performance on liquid surfaces (water) */
    readonly water: number;
}

/**
 * Core racing stats shared by characters and vehicles.
 * Stats use Level notation (0-11 range for most stats).
 */
export interface BaseStats {
    readonly speed: TerrainStats;
    readonly handling: TerrainStats;
    readonly acceleration: number;
    readonly miniTurbo: number;
    readonly weight: number;
    readonly coinCurve: number;
}

/**
 * Represents a playable character.
 */
export interface Character extends BaseStats {
    /** Unique identifier for the character */
    readonly id: string;
    /** Display name of the character */
    readonly name: string;
}

/**
 * Represents a vehicle (kart, bike, or ATV).
 */
export interface Vehicle {
    /** Unique identifier for the vehicle */
    readonly id: string;
    /** Display name of the vehicle */
    readonly name: string;
    /** Vehicle tag */
    readonly tag: string;
}

export interface SurfaceCoverage {
    readonly road: number;
    readonly rough: number;
    readonly water: number;
    readonly neutral: number;
    readonly offRoad: number;
}

/**
 * Represents a race track.
 */
export interface Track {
    /** Unique identifier for the track */
    readonly id: string;
    /** Display name of the track */
    readonly name: string;
    /** Cup or group this track belongs to */
    readonly cup: string;
    /** Surface coverage percentages for the track */
    readonly surfaceCoverage: SurfaceCoverage;
}

/**
 * API response containing all characters.
 */
export interface CharactersResponse {
    readonly dataVersion: string;
    readonly characters: Character[];
}

/**
 * API response containing all vehicles.
 */
export interface VehiclesResponse {
    readonly dataVersion: string;
    readonly vehicles: Vehicle[];
}

/**
 * API response containing all tracks.
 */
export interface TracksResponse {
    readonly dataVersion: string;
    readonly tracks: Track[];
}
