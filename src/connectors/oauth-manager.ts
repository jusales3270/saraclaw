import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface OAuthCredentials {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
}

export interface OAuthProvider {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
}

/**
 * Manages OAuth2 authentication for connectors
 */
export class OAuthManager {
    private db: Database | null = null;
    private dbPath: string;
    private SQL: any;
    private providers: Map<string, OAuth2Client> = new Map();

    constructor(dbPath = path.join(process.cwd(), '.saraclaw', 'oauth.db')) {
        this.dbPath = dbPath;

        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (e) { }
        }
    }

    async init() {
        if (this.db) return;

        this.SQL = await initSqlJs();

        if (fs.existsSync(this.dbPath)) {
            const filebuffer = fs.readFileSync(this.dbPath);
            this.db = new this.SQL.Database(filebuffer);
        } else {
            this.db = new this.SQL.Database();
            this.initSchema();
            this.save();
        }
    }

    private initSchema() {
        if (!this.db) return;
        this.db.run(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        provider TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expiry_date INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }

    private save() {
        if (!this.db) return;
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    /**
     * Initialize OAuth client for a provider
     */
    initProvider(name: string, config: OAuthProvider): void {
        const oauth2Client = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUri
        );

        this.providers.set(name, oauth2Client);
    }

    /**
     * Get authorization URL for user to grant access
     */
    getAuthUrl(provider: string, scopes: string[]): string {
        const client = this.providers.get(provider);

        if (!client) {
            throw new Error(`Provider ${provider} not initialized`);
        }

        return client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent' // Force to get refresh_token
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCode(provider: string, code: string): Promise<OAuthCredentials> {
        const client = this.providers.get(provider);

        if (!client) {
            throw new Error(`Provider ${provider} not initialized`);
        }

        const { tokens } = await client.getToken(code);

        if (!tokens.access_token) {
            throw new Error('No access token received');
        }

        const credentials: OAuthCredentials = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || '',
            expiry_date: tokens.expiry_date || 0
        };

        // Save to database
        await this.saveCredentials(provider, credentials);

        // Set credentials on client
        client.setCredentials(tokens);

        return credentials;
    }

    /**
     * Get stored credentials for a provider
     */
    async getCredentials(provider: string): Promise<OAuthCredentials | null> {
        await this.init();
        if (!this.db) throw new Error('DB init failed');

        const stmt = this.db.prepare(`
      SELECT access_token, refresh_token, expiry_date
      FROM oauth_tokens
      WHERE provider = :provider
    `);

        // sql.js quirk: getAsObject returns object with keys if row found, check values
        const result = stmt.getAsObject({ ':provider': provider }) as any;
        stmt.free();

        if (!result || !result.access_token) {
            return null;
        }

        return {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expiry_date: result.expiry_date
        };
    }

    /**
     * Save credentials to database
     */
    private async saveCredentials(provider: string, credentials: OAuthCredentials): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('DB init failed');

        this.db.run(`
      INSERT INTO oauth_tokens (
        provider, access_token, refresh_token, expiry_date, updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(provider) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expiry_date = excluded.expiry_date,
        updated_at = CURRENT_TIMESTAMP
    `, [
            provider,
            credentials.access_token,
            credentials.refresh_token,
            credentials.expiry_date
        ]);

        this.save();
    }

    /**
     * Refresh access token if expired
     */
    async refreshToken(provider: string): Promise<OAuthCredentials> {
        const client = this.providers.get(provider);
        const credentials = await this.getCredentials(provider);

        if (!client || !credentials) {
            throw new Error(`Provider ${provider} not authenticated`);
        }

        // Only set refresh token for refresh operation
        client.setCredentials({
            refresh_token: credentials.refresh_token
        });

        const { credentials: newTokens } = await client.refreshAccessToken();

        const newCredentials: OAuthCredentials = {
            access_token: newTokens.access_token!,
            refresh_token: newTokens.refresh_token || credentials.refresh_token,
            expiry_date: newTokens.expiry_date || 0
        };

        await this.saveCredentials(provider, newCredentials);

        return newCredentials;
    }

    /**
     * Check if token is expired and refresh if needed
     */
    async ensureValidToken(provider: string): Promise<OAuth2Client> {
        const client = this.providers.get(provider);
        const credentials = await this.getCredentials(provider);

        if (!client || !credentials) {
            throw new Error(`Provider ${provider} not authenticated`);
        }

        client.setCredentials({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token,
            expiry_date: credentials.expiry_date
        });

        // Check if expired (with 5 min buffer)
        const now = Date.now();
        const expiryBuffer = 5 * 60 * 1000;

        if (credentials.expiry_date && credentials.expiry_date - expiryBuffer < now) {
            console.log(`[OAuth] Token expired for ${provider}, refreshing...`);
            await this.refreshToken(provider);
        }

        return client;
    }

    /**
     * Revoke access for a provider
     */
    async revokeAccess(provider: string): Promise<void> {
        const client = this.providers.get(provider);
        const credentials = await this.getCredentials(provider);

        if (client && credentials) {
            try {
                await client.revokeToken(credentials.access_token);
            } catch (error) {
                console.error('[OAuth] Error revoking token:', error);
            }
        }

        await this.init();
        if (this.db) {
            this.db.run(`DELETE FROM oauth_tokens WHERE provider = ?`, [provider]);
            this.save();
        }
    }
}
