import { google } from 'googleapis';
import { BaseConnector } from './base-connector.js';
import { OAuthManager } from './oauth-manager.js';
import { VectorStore } from '../../packages/sara-memory/src/vector-store.js';
import { IncrementalSync } from '../../packages/sara-memory/src/incremental-sync.js';
import { FileProcessor } from './file-processor.js';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: Date;
    content: string;
}

/**
 * Google Drive connector
 */
export class GoogleDriveConnector extends BaseConnector {
    private static readonly PROVIDER = 'google-drive';
    private static readonly SCOPES = [
        'https://www.googleapis.com/auth/drive.readonly'
    ];

    private fileProcessor: FileProcessor;

    constructor(
        vectorStore: VectorStore,
        incrementalSync: IncrementalSync,
        private oauthManager: OAuthManager
    ) {
        super('google-drive', vectorStore, incrementalSync);
        this.fileProcessor = new FileProcessor();
    }

    getAuthUrl(): string {
        return this.oauthManager.getAuthUrl(
            GoogleDriveConnector.PROVIDER,
            GoogleDriveConnector.SCOPES
        );
    }

    async authenticate(code: string): Promise<void> {
        await this.oauthManager.exchangeCode(GoogleDriveConnector.PROVIDER, code);
        console.log('[DriveConnector] Authentication successful');
    }

    async fetchData(): Promise<any[]> {
        const lastSync = await this.incrementalSync.getLastSyncTime(this.sourceName);
        const since = lastSync || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        console.log(`[DriveConnector] Fetching files since ${since.toISOString()}`);

        // Check if token exists
        const creds = await this.oauthManager.getCredentials(GoogleDriveConnector.PROVIDER);
        if (!creds) {
            console.warn('[DriveConnector] No credentials found. Skipping fetch.');
            return [];
        }

        const oauth2Client = await this.oauthManager.ensureValidToken(GoogleDriveConnector.PROVIDER);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Query for files modified after last sync
        const query = `modifiedTime > '${since.toISOString()}' and trashed = false`;

        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name, mimeType, modifiedTime)',
            pageSize: 50 // Limited batch
        });

        const files = response.data.files || [];
        console.log(`[DriveConnector] Found ${files.length} files`);

        // Fetch content for each file
        const driveFiles: DriveFile[] = [];

        for (const file of files) {
            if (!file.id) continue;
            try {
                const content = await this.fetchFileContent(drive, file.id, file.mimeType || '');

                driveFiles.push({
                    id: file.id,
                    name: file.name || 'Untitled',
                    mimeType: file.mimeType || 'unknown',
                    modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
                    content
                });
            } catch (error) {
                console.error(`[DriveConnector] Error fetching file ${file.name}:`, error);
            }
        }

        return driveFiles;
    }

    /**
     * Fetch file content
     */
    private async fetchFileContent(drive: any, fileId: string, mimeType: string): Promise<string> {
        // Google Docs need export
        if (mimeType.includes('google-apps')) {
            return this.exportGoogleDoc(drive, fileId, mimeType);
        }

        // Regular files (if supported by drive API download)
        // Only try to download if it's not a folder or unknown binary without export
        try {
            const response = await drive.files.get({
                fileId,
                alt: 'media'
            }, { responseType: 'arraybuffer' });

            const buffer = Buffer.from(response.data);

            // Process based on MIME type
            return this.fileProcessor.extractText(buffer, mimeType);
        } catch (e) {
            console.warn(`[DriveConnector] Could not download file ${fileId} (${mimeType}):`, e);
            return '';
        }
    }

    /**
     * Export Google Docs to plain text
     */
    private async exportGoogleDoc(drive: any, fileId: string, mimeType: string): Promise<string> {
        let exportMimeType = 'text/plain';

        // Map Google types to export types
        if (mimeType.includes('document')) {
            exportMimeType = 'text/plain';
        } else if (mimeType.includes('spreadsheet')) {
            exportMimeType = 'text/csv';
        } else if (mimeType.includes('presentation')) {
            exportMimeType = 'text/plain';
        } else {
            return ''; // Skip unknown google apps types
        }

        try {
            const response = await drive.files.export({
                fileId,
                mimeType: exportMimeType
            });

            return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        } catch (e) {
            console.warn(`[DriveConnector] Export failed for ${fileId}:`, e);
            return '';
        }
    }

    async transformData(data: any): Promise<string> {
        const file = data as DriveFile;

        return `File: ${file.name}
Type: ${file.mimeType}
Modified: ${file.modifiedTime.toISOString()}

${file.content}`;
    }

    async prepareMetadata(data: any): Promise<any> {
        const file = data as DriveFile;

        return {
            source: 'google-drive',
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            modifiedTime: file.modifiedTime,
            tags: ['drive', 'document']
        };
    }

    async validateData(data: any): Promise<boolean> {
        const file = data as DriveFile;

        // Skip empty files
        if (!file.content || file.content.trim().length === 0) {
            return false;
        }

        // Skip binary files without text extraction
        if (file.content.length < 10) {
            return false;
        }

        return true;
    }
}
