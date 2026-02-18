import express from 'express';
import crypto from 'crypto';
import { OAuthManager } from '../../connectors/oauth-manager.js';
import { GmailConnector } from '../../connectors/gmail-connector.js';
import { GoogleDriveConnector } from '../../connectors/google-drive-connector.js';
import { VectorStore } from '../../../packages/sara-memory/src/vector-store.js';
import { IncrementalSync } from '../../../packages/sara-memory/src/incremental-sync.js';

const router = express.Router();

// ========================================
// H3 FIX: Shared singletons (imported by connectors.ts too)
// ========================================
export const sharedOAuthManager = new OAuthManager();
export const sharedVectorStore = new VectorStore();
export const sharedIncrementalSync = new IncrementalSync();

// Initialize OAuth providers if env vars exist
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    sharedOAuthManager.initProvider('gmail', {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: `${process.env.SARA_APP_URL || 'http://localhost:3000'}/api/oauth/callback/gmail`,
        scopes: []
    });

    sharedOAuthManager.initProvider('google-drive', {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: `${process.env.SARA_APP_URL || 'http://localhost:3000'}/api/oauth/callback/google-drive`,
        scopes: []
    });
}

export const sharedGmailConnector = new GmailConnector(sharedVectorStore, sharedIncrementalSync, sharedOAuthManager);
export const sharedDriveConnector = new GoogleDriveConnector(sharedVectorStore, sharedIncrementalSync, sharedOAuthManager);

// Initial async init
sharedOAuthManager.init().catch(console.error);

// ========================================
// C5 FIX: CSRF state tokens for OAuth
// ========================================
const pendingStates = new Map<string, { provider: string; expiresAt: number }>();

// Cleanup expired states every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of pendingStates.entries()) {
        if (value.expiresAt < now) pendingStates.delete(key);
    }
}, 5 * 60 * 1000);

/**
 * GET /api/oauth/start/:provider
 * Generate CSRF state and redirect to OAuth provider
 */
router.get('/start/:provider', (req, res) => {
    const { provider } = req.params;

    try {
        const state = crypto.randomBytes(32).toString('hex');
        pendingStates.set(state, {
            provider,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 min expiry
        });

        let authUrl: string;

        if (provider === 'gmail') {
            authUrl = sharedGmailConnector.getAuthUrl();
        } else if (provider === 'google-drive') {
            authUrl = sharedDriveConnector.getAuthUrl();
        } else {
            return res.status(404).json({ error: 'Provider not found' });
        }

        // Append state parameter to auth URL
        const separator = authUrl.includes('?') ? '&' : '?';
        const fullUrl = `${authUrl}${separator}state=${state}`;

        res.json({ authUrl: fullUrl, state });

    } catch (error: any) {
        console.error('[OAuth] Error starting flow:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/oauth/callback/:provider
 * Handle OAuth callback with CSRF state validation
 */
router.get('/callback/:provider', async (req, res) => {
    const { provider } = req.params;
    const { code, error, state } = req.query;

    // C6 FIX: Sanitize error parameter to prevent XSS
    if (error) {
        const safeError = String(error).replace(/[<>"'&]/g, '');
        return res.status(400).send(`Authentication failed: ${safeError}`);
    }

    if (!code) {
        return res.status(400).send('No authorization code received');
    }

    // C5 FIX: Validate CSRF state
    if (!state || typeof state !== 'string') {
        return res.status(400).send('Missing state parameter — possible CSRF attack.');
    }

    const pendingState = pendingStates.get(state);
    if (!pendingState) {
        return res.status(400).send('Invalid or expired state parameter.');
    }

    if (pendingState.provider !== provider) {
        return res.status(400).send('State/provider mismatch.');
    }

    // Consume the state (one-time use)
    pendingStates.delete(state);

    try {
        if (provider === 'gmail') {
            await sharedGmailConnector.authenticate(code as string);
        } else if (provider === 'google-drive') {
            await sharedDriveConnector.authenticate(code as string);
        } else {
            return res.status(404).send('Provider not found');
        }

        // Safe HTML response (no user input injected)
        res.send(`
      <html>
        <body>
          <h1>&#x2705; Authentication Successful!</h1>
          <p>You can close this window and return to Sara.</p>
          <script>
            setTimeout(function() { window.close(); }, 3000);
          </script>
        </body>
      </html>
    `);

    } catch (err: any) {
        console.error('[OAuth] Callback error:', err);
        res.status(500).send('Authentication error. Please try again.');
    }
});

export default router;
