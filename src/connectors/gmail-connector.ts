import { google } from 'googleapis';
import { BaseConnector } from './base-connector.js';
import { OAuthManager } from './oauth-manager.js';
import { VectorStore } from '../../packages/sara-memory/src/vector-store.js';
import { IncrementalSync } from '../../packages/sara-memory/src/incremental-sync.js';

export interface GmailMessage {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to: string;
    date: Date;
    body: string;
}

/**
 * Gmail connector using OAuth2
 */
export class GmailConnector extends BaseConnector {
    private static readonly PROVIDER = 'gmail';
    private static readonly SCOPES = [
        'https://www.googleapis.com/auth/gmail.readonly'
    ];

    constructor(
        vectorStore: VectorStore,
        incrementalSync: IncrementalSync,
        private oauthManager: OAuthManager
    ) {
        super('gmail', vectorStore, incrementalSync);
    }

    /**
     * Get OAuth authorization URL
     */
    getAuthUrl(): string {
        return this.oauthManager.getAuthUrl(
            GmailConnector.PROVIDER,
            GmailConnector.SCOPES
        );
    }

    /**
     * Complete OAuth flow with authorization code
     */
    async authenticate(code: string): Promise<void> {
        await this.oauthManager.exchangeCode(GmailConnector.PROVIDER, code);
        console.log('[GmailConnector] Authentication successful');
    }

    /**
     * Fetch emails since last sync
     */
    async fetchData(): Promise<any[]> {
        const lastSync = await this.incrementalSync.getLastSyncTime(this.sourceName);
        const since = lastSync || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: 90 days

        console.log(`[GmailConnector] Fetching emails since ${since.toISOString()}`);

        // Check if token exists before trying to use it
        const creds = await this.oauthManager.getCredentials(GmailConnector.PROVIDER);
        if (!creds) {
            console.warn('[GmailConnector] No credentials found. Skipping fetch.');
            return [];
        }

        const oauth2Client = await this.oauthManager.ensureValidToken(GmailConnector.PROVIDER);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Build query
        const query = `after:${Math.floor(since.getTime() / 1000)}`;

        // List messages
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 50 // Fetch small batch for testing/safety
        });

        const messageIds = response.data.messages || [];
        console.log(`[GmailConnector] Found ${messageIds.length} messages`);

        // Fetch full messages
        const messages: GmailMessage[] = [];

        for (const { id } of messageIds) {
            if (!id) continue;
            try {
                const message = await this.fetchMessage(gmail, id);
                messages.push(message);
            } catch (error) {
                console.error(`[GmailConnector] Error fetching message ${id}:`, error);
            }
        }

        return messages;
    }

    /**
     * Fetch single message details
     */
    private async fetchMessage(gmail: any, messageId: string): Promise<GmailMessage> {
        const response = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });

        const message = response.data;
        const headers = message.payload.headers;

        // Extract headers
        const getHeader = (name: string) => {
            const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
            return header?.value || '';
        };

        const subject = getHeader('Subject');
        const from = getHeader('From');
        const to = getHeader('To');
        const dateStr = getHeader('Date');

        // Extract body
        const body = this.extractBody(message.payload);

        return {
            id: messageId,
            threadId: message.threadId,
            subject,
            from,
            to,
            date: new Date(dateStr),
            body
        };
    }

    /**
     * Extract email body from payload
     */
    private extractBody(payload: any): string {
        let body = '';

        if (payload.body?.data) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload.parts) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                    body += Buffer.from(part.body.data, 'base64').toString('utf-8');
                } else if (part.parts) {
                    body += this.extractBody(part); // Recursive
                }
            }
        }

        return body;
    }

    /**
     * Transform email into text for embedding
     */
    async transformData(data: any): Promise<string> {
        const email = data as GmailMessage;

        // Format email as structured text
        const text = `Email: ${email.subject}
From: ${email.from}
To: ${email.to}
Date: ${email.date.toISOString()}

${email.body}`;

        return text;
    }

    /**
     * Prepare metadata for storage
     */
    async prepareMetadata(data: any): Promise<any> {
        const email = data as GmailMessage;

        return {
            source: 'gmail',
            emailId: email.id,
            threadId: email.threadId,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date,
            tags: ['email', 'gmail']
        };
    }

    /**
     * Validate email data
     */
    async validateData(data: any): Promise<boolean> {
        const email = data as GmailMessage;

        // Skip emails without body
        if (!email.body || email.body.trim().length === 0) {
            return false;
        }

        // Skip automated emails (optional)
        const automatedSenders = ['noreply@', 'no-reply@', 'donotreply@', 'notifications@'];
        if (automatedSenders.some(sender => email.from.toLowerCase().includes(sender))) {
            return false;
        }

        return true;
    }
}
