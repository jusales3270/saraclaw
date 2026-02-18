import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { RestServer } from '../../rest-server.js';
import fs from 'fs';
import path from 'path';

import { vi } from 'vitest';

// Mock ChatHistory to avoid better-sqlite3 native binding issues
vi.mock('../../../gateway/chat-history.js', () => {
    return {
        ChatHistory: class {
            getStats() { return {}; }
            getConversation() { return null; }
            getHistory() { return []; }
            deleteConversation() { }
            searchMessages() { return []; }
            addMessage() { }
        }
    };
});

// Mock EmbeddingClient to avoid API key requirement
vi.mock('../../../../packages/sara-memory/src/embedding-client.js', () => {
    return {
        EmbeddingClient: class {
            async embed() {
                return {
                    embedding: new Array(1536).fill(0.1),
                    usage: { tokens: 10, cost: 0.001 }
                };
            }
            static cosineSimilarity() { return 1.0; }
        }
    };
});

describe('Ingest API', () => {
    const server = new RestServer().createApp();

    it('POST /api/ingest/text should create atoms', async () => {
        const response = await request(server)
            .post('/api/ingest/text')
            .send({
                content: 'Sara é uma entidade de IA soberana criada para ajudar usuários.',
                source: 'test'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.atomsCreated).toBeGreaterThan(0);
    }, 30000);

    it('POST /api/ingest/file should process .txt file', async () => {
        // Create temp test file
        const tmpFile = path.resolve('/tmp/test-ingest.txt');
        // Ensure /tmp exists (windows fix)
        const tmpDir = path.dirname(tmpFile);
        if (!fs.existsSync(tmpDir)) {
            // On Windows, /tmp might not exist or be valid. Use a local temp.
            // But for this test let's try to use a local temp if /tmp fails or just use Node's os.tmpdir() logic or similar?
            // For simplicity, let's just make sure the directory exists or use a relative path.
            // actually the code uses /tmp/sara-uploads/ so we should just stick to that or a safe path.
            // Let's use a local file for the test source.
            // Since the server will read from `req.file.path` which multer generates, we just need a file to upload.
        }

        // Write a dummy file to upload
        const uploadSourcePath = 'test-upload.txt';
        fs.writeFileSync(uploadSourcePath, 'Este é um arquivo de teste para a Sara.');

        try {
            const response = await request(server)
                .post('/api/ingest/file')
                .attach('file', uploadSourcePath);

            expect(response.status).toBe(200);
            expect(response.body.atomsCreated).toBeGreaterThan(0);
        } finally {
            fs.unlinkSync(uploadSourcePath);
        }

    }, 30000);

    it('GET /api/pulse/first should stream SSE events', async () => {
        const response = await request(server)
            .get('/api/pulse/first')
            .expect('Content-Type', /text\/event-stream/);

        expect(response.status).toBe(200);
    }, 60000);
});
