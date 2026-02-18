import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VectorStore } from '../src/vector-store.js';
import fs from 'fs';
import path from 'path';
import { EmbeddingClient } from '../src/embedding-client.js';

describe('VectorStore with Embeddings (sql.js)', () => {
    let vectorStore: VectorStore;
    const testDbPath = path.join(process.cwd(), 'test-vector-store.db');

    // Mock embedding
    const mockEmbed = async (text: string) => {
        const dim = 1536;
        const embedding = new Array(dim).fill(0);
        const val = text.length / 100;
        embedding[0] = val;
        return {
            embedding,
            model: 'text-embedding-3-small',
            usage: { tokens: 10, cost: 0.0000002 }
        };
    };

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            try { fs.unlinkSync(testDbPath); } catch (e) { }
        }

        process.env.OPENAI_API_KEY = 'test-key';

        // Manual mock of prototype methodology
        vi.spyOn(EmbeddingClient.prototype, 'embed').mockImplementation(mockEmbed as any);

        vectorStore = new VectorStore(testDbPath);
    });

    afterEach(() => {
        vectorStore.close();
        vi.restoreAllMocks();

        if (fs.existsSync(testDbPath)) {
            try { fs.unlinkSync(testDbPath); } catch (e) { }
        }
    });

    it('should add atom with embedding', async () => {
        const id = await vectorStore.add('Sara is a sovereign AI entity', {
            source: 'test',
            tags: ['identity']
        });

        expect(id).toBeDefined();
        expect(id).toMatch(/^atom-/);

        // Verify file created
        expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should perform semantic search', async () => {
        await vectorStore.add('Sara é uma entidade de IA soberana', {
            source: 'test'
        });

        await vectorStore.add('O orçamento diário é de $2.00', {
            source: 'test'
        });

        // We need to wait a bit or ensure save happens? add() calls save() synchronously after init.

        const results = await vectorStore.search('autonomous AI', 5);

        expect(results.length).toBeGreaterThan(0);
        const topResult = results[0];
        expect(topResult.content).toBeDefined();
    }, 10000); // Increase timeout for WASM load

    it('should deduplicate identical content', async () => {
        const content = 'Duplicate content test';

        const id1 = await vectorStore.add(content, { source: 'test' });
        const id2 = await vectorStore.add(content, { source: 'test' });

        expect(id1).toBe(id2);
    });

    it('should track embedding costs', async () => {
        await vectorStore.add('Test content 1', { source: 'test' });

        const costs = await vectorStore.getEmbeddingCosts();

        expect(costs.totalTokens).toBeGreaterThan(0);
        expect(costs.totalCost).toBeGreaterThan(0);
    });
});
