/**
 * Represents speed or handling stats for different terrain types.
 */
export interface TerrainStats {
    /** Stat for solid terrain (e.g., road) */
    readonly solid: number;
    /** Stat for coarse terrain (e.g., off-road) */
    readonly coarse: number;
    /** Stat for liquid terrain (e.g., water) */
    readonly liquid: number;
}

/**
 * Represents a playable character and their stats.
 */
export interface Character {
    /** Unique identifier for the character */
    readonly id: string;
    /** Display name of the character */
    readonly name: string;

    /** Display stats for UI */
    readonly display: {
        /** Display speed stat */
        readonly speed: number;
        /** Display handling stat */
        readonly handling: number;
    };

    /** Speed stats by terrain */
    readonly speed: TerrainStats;
    /** Handling stats by terrain */
    readonly handling: TerrainStats;
    /** Acceleration stat */
    readonly acceleration: number;
    /** Mini-turbo stat */
    readonly miniTurbo: number;
    /** Weight stat */
    readonly weight: number;
    /** Coin curve stat */
    readonly coinCurve: number;

    /** If true, display stats require adjustment for this character */
    readonly requiresDisplayAdjustment: boolean;
}

/**
 * Represents a vehicle and its stats.
 */
export interface Vehicle {
    /** Unique identifier for the vehicle */
    readonly id: string;
    /** Display name of the vehicle */
    readonly name: string;
    /** Vehicle category */
    readonly category: 'kart' | 'bike' | 'atv';

    /** Display stats for UI */
    readonly display: {
        /** Display speed stat */
        readonly speed: number;
        /** Display handling stat */
        readonly handling: number;
    };

    /** Speed stats by terrain */
    readonly speed: TerrainStats;
    /** Handling stats by terrain */
    readonly handling: TerrainStats;
    /** Acceleration stat */
    readonly acceleration: number;
    /** Mini-turbo stat */
    readonly miniTurbo: number;
    /** Weight stat */
    readonly weight: number;
    /** Coin curve stat */
    readonly coinCurve: number;

    /** If true, display stats require adjustment for this vehicle */
    readonly requiresDisplayAdjustment: boolean;
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
}

/**
 * API response containing all characters.
 */
export interface CharactersResponse {
    readonly characters: Character[];
}

/**
 * API response containing all vehicles.
 */
export interface VehiclesResponse {
    readonly vehicles: Vehicle[];
}

/**
 * API response containing all tracks.
 */
export interface TracksResponse {
    readonly tracks: Track[];
}
