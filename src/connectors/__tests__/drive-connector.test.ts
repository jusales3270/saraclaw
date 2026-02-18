import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveConnector } from '../google-drive-connector.js';
import { VectorStore } from '../../../packages/sara-memory/src/vector-store.js';
import { IncrementalSync } from '../../../packages/sara-memory/src/incremental-sync.js';

vi.mock('googleapis', () => {
    return {
        google: {
            drive: vi.fn().mockReturnValue({
                files: {
                    list: vi.fn().mockResolvedValue({
                        data: {
                            files: [
                                { id: 'file1', name: 'Test Doc', mimeType: 'text/plain', modifiedTime: new Date().toISOString() }
                            ]
                        }
                    }),
                    get: vi.fn().mockResolvedValue({
                        data: Buffer.from('Test Content')
                    }),
                    export: vi.fn().mockResolvedValue({
                        data: 'Exported Content'
                    })
                }
            }),
            auth: {
                OAuth2: vi.fn()
            }
        }
    };
});

describe('GoogleDriveConnector', () => {
    let connector: GoogleDriveConnector;
    let mockVectorStore: any;
    let mockSync: any;
    let mockOAuth: any;

    beforeEach(() => {
        mockVectorStore = {
            add: vi.fn().mockResolvedValue('atom-id')
        } as any;

        mockSync = {
            getLastSyncTime: vi.fn().mockResolvedValue(new Date(Date.now() - 10000)),
            updateSyncTime: vi.fn().mockResolvedValue(undefined),
            recordSync: vi.fn().mockResolvedValue(undefined)
        } as any;

        mockOAuth = {
            getAuthUrl: vi.fn().mockReturnValue('http://auth-url'),
            getCredentials: vi.fn().mockResolvedValue({ access_token: 'token' }),
            ensureValidToken: vi.fn().mockResolvedValue({})
        } as any;

        connector = new GoogleDriveConnector(
            mockVectorStore,
            mockSync,
            mockOAuth
        );
    });

    it('should generate auth url', () => {
        const url = connector.getAuthUrl();
        expect(url).toBe('http://auth-url');
    });

    it('should fetch and process files', async () => {
        const result = await connector.sync();

        expect(result.success).toBe(true);
        expect(result.itemsSynced).toBe(1);

        expect(mockOAuth.ensureValidToken).toHaveBeenCalledWith('google-drive');

        expect(mockVectorStore.add).toHaveBeenCalledWith(
            expect.stringContaining('Test Content'),
            expect.objectContaining({
                source: 'google-drive',
                fileName: 'Test Doc'
            })
        );
    });
});
