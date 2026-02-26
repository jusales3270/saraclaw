/**
 * SaraClaw API Security Middleware
 * 
 * Provides authentication, rate limiting, and security headers
 * for the REST API.
 * 
 * SECURITY NOTES:
 * - Uses timing-safe comparison to prevent timing attacks
 * - Blocks ALL protected endpoints in production when no token is configured
 * - Only recognizes SARACLAW_* environment variables
 */

import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function safeTokenCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Auth middleware — validates Bearer token against SARACLAW_GATEWAY_TOKEN.
 * 
 * In production (NODE_ENV=production):
 *   - If SARACLAW_GATEWAY_TOKEN is NOT set, all protected endpoints return 503.
 * In development:
 *   - If SARACLAW_GATEWAY_TOKEN is NOT set, a warning is logged and requests are allowed.
 */
let warnedNoToken = false;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = process.env.SARACLAW_GATEWAY_TOKEN;
    const isProduction = process.env.NODE_ENV === 'production';

    // Health endpoint is always public
    if (req.path === '/api/health') {
        next();
        return;
    }

    // OAuth callbacks are public but should be validated by their own handlers
    if (req.path.startsWith('/api/oauth/callback')) {
        next();
        return;
    }

    // If no token is configured...
    if (!token) {
        if (isProduction) {
            // BLOCK in production — never allow unprotected access
            console.error('[Security] 🚨 SARACLAW_GATEWAY_TOKEN not set in production — blocking all protected endpoints');
            res.status(503).json({ error: 'Service misconfigured. Authentication token not set.' });
            return;
        }

        // Allow in development, but warn
        if (!warnedNoToken) {
            console.warn('[Security] ⚠️  SARACLAW_GATEWAY_TOKEN not set — API is UNPROTECTED. Set it for production!');
            warnedNoToken = true;
        }
        next();
        return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required. Provide Bearer token.' });
        return;
    }

    const providedToken = authHeader.substring(7);

    // Timing-safe comparison to prevent timing attacks
    if (!safeTokenCompare(providedToken, token)) {
        res.status(403).json({ error: 'Invalid authentication token.' });
        return;
    }

    next();
}

/**
 * Get allowed CORS origins from environment or defaults.
 * Uses SARACLAW_CORS_ORIGINS env var.
 */
export function getAllowedOrigins(): string[] {
    const envOrigins = process.env.SARACLAW_CORS_ORIGINS;

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
