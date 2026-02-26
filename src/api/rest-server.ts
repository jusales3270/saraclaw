import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware, getAllowedOrigins } from './middleware/security.js';

import usageStatsRouter from './routes/usage-stats.js';
import securityLogsRouter from './routes/security-logs.js';
import configRouter from './routes/config.js';
import conversationsRouter from './routes/conversations.js';
import healthRouter from './routes/health.js';

import connectorsRouter from './routes/connectors.js';
import oauthRouter from './routes/oauth-callback.js';
import ingestRouter from './routes/ingest.js';
import pulseRouter from './routes/pulse.js';

export class RestServer {
    createApp(): Express {
        const app = express();

        // ========================================
        // C4: Security headers (Helmet)
        // ========================================
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:'],
                    connectSrc: ["'self'", ...getAllowedOrigins()],
                },
            },
            crossOriginEmbedderPolicy: false, // Allow SSE
        }));

        // ========================================
        // C2: Restricted CORS
        // ========================================
        const allowedOrigins = getAllowedOrigins();
        const isProduction = process.env.NODE_ENV === 'production';
        app.use(cors({
            origin: (origin, callback) => {
                // In production, only allow configured origins
                // In development, also allow no-origin requests (curl, Postman)
                if (!origin) {
                    if (isProduction) {
                        return callback(new Error('CORS: requests without Origin header are blocked in production'));
                    }
                    return callback(null, true);
                }
                if (allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                callback(new Error(`CORS: origin ${origin} not allowed`));
            },
            credentials: true,
        }));

        // ========================================
        // C3: Rate limiting
        // ========================================
        const apiLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 100,            // 100 requests per minute per IP
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'Too many requests. Try again later.' },
        });
        app.use('/api/', apiLimiter);

        // Stricter limit for sensitive endpoints
        const strictLimiter = rateLimit({
            windowMs: 60 * 1000,
            max: 10,
            message: { error: 'Rate limit exceeded for this endpoint.' },
        });

        app.use(express.json({ limit: '5mb' }));

        // ========================================
        // C1: Authentication middleware
        // ========================================
        app.use(authMiddleware);

        // ========================================
        // Routes
        // ========================================
        app.use('/api/usage', usageStatsRouter);
        app.use('/api/security', securityLogsRouter);
        app.use('/api/config', strictLimiter, configRouter);
        app.use('/api/conversations', conversationsRouter);
        app.use('/api/health', healthRouter);

        // Connectors
        app.use('/api/connectors', connectorsRouter);
        app.use('/api/oauth', oauthRouter);

        // Onboarding
        app.use('/api/ingest', strictLimiter, ingestRouter);
        app.use('/api/pulse', pulseRouter);

        return app;
    }
}
