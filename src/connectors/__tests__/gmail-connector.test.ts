import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GmailConnector } from '../gmail-connector.js';
import { OAuthManager } from '../oauth-manager.js';
import { VectorStore } from '../../../packages/sara-memory/src/vector-store.js';
import { IncrementalSync } from '../../../packages/sara-memory/src/incremental-sync.js';

// Mock googleapis
vi.mock('googleapis', () => {
    return {
        google: {
            gmail: vi.fn().mockReturnValue({
                users: {
                    messages: {
                        list: vi.fn().mockResolvedValue({
                            data: {
                                messages: [
                                    { id: 'msg1', threadId: 'thread1' }
                                ]
                            }
                        }),
                        get: vi.fn().mockResolvedValue({
                            data: {
                                id: 'msg1',
                                threadId: 'thread1',
                                payload: {
                                    headers: [
                                        { name: 'Subject', value: 'Test Subject' },
                                        { name: 'From', value: 'sender@example.com' },
                                        { name: 'To', value: 'me@example.com' },
                                        { name: 'Date', value: new Date().toISOString() }
                                    ],
                                    body: { data: Buffer.from('Test Body').toString('base64') }
                                }
                            }
                        })
                    }
                }
            }),
            auth: {
                OAuth2: vi.fn()
            }
        }
    };
});

describe('GmailConnector', () => {
    let connector: GmailConnector;
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

        connector = new GmailConnector(
            mockVectorStore,
            mockSync,
            mockOAuth
        );
    });

    it('should generate auth url', () => {
        const url = connector.getAuthUrl();
        expect(url).toBe('http://auth-url');
        expect(mockOAuth.getAuthUrl).toHaveBeenCalledWith('gmail', expect.any(Array));
    });

    it('should fetch and process emails', async () => {
        const result = await connector.sync();

        expect(result.success).toBe(true);
        expect(result.itemsSynced).toBe(1);

        expect(mockOAuth.ensureValidToken).toHaveBeenCalledWith('gmail');

        // Verify vector store add
        expect(mockVectorStore.add).toHaveBeenCalledWith(
            expect.stringContaining('Test Subject'),
            expect.objectContaining({
                source: 'gmail',
                subject: 'Test Subject'
            })
        );

        // Verify sync update
        expect(mockSync.updateSyncTime).toHaveBeenCalled();
    });
});
