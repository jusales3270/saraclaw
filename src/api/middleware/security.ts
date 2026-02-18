/**
 * Sara API Security Middleware
 * 
 * Provides authentication, rate limiting, and security headers
 * for the REST API.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Auth middleware — validates Bearer token against SARACLAW_GATEWAY_TOKEN.
 * 
 * If SARACLAW_GATEWAY_TOKEN is not set, auth is skipped (dev mode)
 * but a warning is logged on first request.
 */
let warnedNoToken = false;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = process.env.SARACLAW_GATEWAY_TOKEN;

    // If no token is configured, allow all (dev mode) but warn
    if (!token) {
        if (!warnedNoToken) {
            console.warn('[Security] ⚠️  SARACLAW_GATEWAY_TOKEN not set — API is UNPROTECTED. Set it for production!');
            warnedNoToken = true;
        }
        next();
        return;
    }

    // Health and OAuth callbacks are public
    if (req.path === '/api/health' || req.path.startsWith('/api/oauth/callback')) {
        next();
        return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required. Provide Bearer token.' });
        return;
    }

    const providedToken = authHeader.substring(7);

    if (providedToken !== token) {
        res.status(403).json({ error: 'Invalid authentication token.' });
        return;
    }

    next();
}

/**
 * Get allowed CORS origins from environment or defaults
 */
export function getAllowedOrigins(): string[] {
    const envOrigins = process.env.SARA_CORS_ORIGINS;

    if (envOrigins) {
        return envOrigins.split(',').map(o => o.trim());
    }

    // Default: only localhost variants for dev
    return [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
    ];
}
