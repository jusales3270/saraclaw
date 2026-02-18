import express from 'express';
import {
    sharedOAuthManager,
    sharedVectorStore,
    sharedIncrementalSync,
    sharedGmailConnector,
    sharedDriveConnector
} from './oauth-callback.js';

const router = express.Router();

/**
 * GET /api/connectors
 * List available connectors
 */
router.get('/', async (req, res) => {
    try {
        const gmailLastSync = await sharedIncrementalSync.getLastSyncTime('gmail');
        const driveLastSync = await sharedIncrementalSync.getLastSyncTime('google-drive');

        res.json({
            connectors: [
                {
                    name: 'gmail',
                    authenticated: false, // TODO: Check if has valid token via sharedOAuthManager
                    lastSync: gmailLastSync
                },
                {
                    name: 'google-drive',
                    authenticated: false,
                    lastSync: driveLastSync
                }
            ]
        });
    } catch (error: any) {
        console.error('[API] Error listing connectors:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/connectors/:name/auth
 * Get OAuth URL for connector (redirects through /api/oauth/start/:provider)
 */
router.get('/:name/auth', (req, res) => {
    const { name } = req.params;

    try {
        let authUrl: string;

        if (name === 'gmail') {
            authUrl = sharedGmailConnector.getAuthUrl();
        } else if (name === 'google-drive') {
            authUrl = sharedDriveConnector.getAuthUrl();
        } else {
            return res.status(404).json({ error: 'Connector not found' });
        }

        res.json({ authUrl });

    } catch (error: any) {
        console.error('[API] Error getting auth URL:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/connectors/:name/sync
 * Trigger manual sync
 */
router.post('/:name/sync', async (req, res) => {
    const { name } = req.params;

    try {
        let result;

        if (name === 'gmail') {
            result = await sharedGmailConnector.sync();
        } else if (name === 'google-drive') {
            result = await sharedDriveConnector.sync();
        } else {
            return res.status(404).json({ error: 'Connector not found' });
        }

        res.json(result || { status: 'success' });

    } catch (error: any) {
        console.error('[API] Error syncing:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/connectors/:name/stats
 * Get sync statistics
 */
router.get('/:name/stats', async (req, res) => {
    const { name } = req.params;

    try {
        const stats = await sharedIncrementalSync.getSyncStats(name);
        res.json(stats);
    } catch (error: any) {
        console.error('[API] Error getting sync stats:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
