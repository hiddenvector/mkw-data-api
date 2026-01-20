import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { Character, Vehicle, Track, CharactersResponse, VehiclesResponse, TracksResponse } from './types';

import charactersData from '../data/characters.json';
import vehiclesData from '../data/vehicles.json';
import tracksData from '../data/tracks.json';

const app = new Hono().basePath('/mkw/api/v1');

app.use('/*', cors());

app.use('/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'public, max-age=3600'); // 1 hour
});

app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ========== Characters Endpoints ==========

// GET /mkw/api/v1/characters - List all characters
app.get('/characters', (c) => {
    return c.json(charactersData as CharactersResponse);
});

// GET /mkw/api/v1/characters/:id - Get character by ID
app.get('/characters/:id', (c) => {
    const id = c.req.param('id');
    const character = (charactersData as CharactersResponse).characters.find((char) =>
        char.id === id
    );

    if (!character) {
        return c.json({ error: 'Character not found' }, 404);
    }

    return c.json(character);
});

// ========== Vehicles Endpoints ==========

// GET /mkw/api/v1/vehicles - List all vehicles
app.get('/vehicles', (c) => {
    return c.json(vehiclesData as VehiclesResponse);
});

// GET /mkw/api/v1/vehicles/:id - Get vehicle by ID
app.get('/vehicles/:id', (c) => {
    const id = c.req.param('id');
    const vehicle = (vehiclesData as VehiclesResponse).vehicles.find((veh) =>
        veh.id === id
    );

    if (!vehicle) {
        return c.json({ error: 'Vehicle not found' }, 404);
    }

    return c.json(vehicle);
});

// ========== Tracks Endpoints ==========

// GET /mkw/api/v1/tracks - List all tracks
app.get('/tracks', (c) => {
    return c.json(tracksData as TracksResponse);
});

// GET /mkw/api/v1/tracks/:id - Get track by ID
app.get('/tracks/:id', (c) => {
    const id = c.req.param('id');
    const track = (tracksData as TracksResponse).tracks.find( (t) => t.id === id );

    if (!track) {
        return c.json({ error: 'Track not found' }, 404);
    }

    return c.json(track);
});

// ========== 404 Handler ==========
app.notFound((c) => {
    return c.json({
        error: 'Endpoint not found' ,
        availableEndpoints: [
            '/mkw/api/v1/health',
            '/mkw/api/v1/characters',
            '/mkw/api/v1/characters/:id',
            '/mkw/api/v1/vehicles',
            '/mkw/api/v1/vehicles/:id',
            '/mkw/api/v1/tracks',
            '/mkw/api/v1/tracks/:id'
        ]
    }, 404);
});

export default app;
