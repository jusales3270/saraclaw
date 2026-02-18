import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { EmbeddingClient } from './embedding-client.js';

export interface Atom {
    id: string;
    content: string;
    embedding: number[];
    metadata: {
        source: string;
        tags?: string[];
        timestamp: Date;
        [key: string]: any;
    };
}

export interface SearchResult extends Atom {
    similarity: number;
}

/**
 * Vector Store with semantic search using embeddings (sql.js version)
 */
export class VectorStore {
    private db: Database | null = null;
    private dbPath: string;
    private embeddingClient: EmbeddingClient;
    private SQL: any;

    constructor(dbPath = '/home/node/.saraclaw/openaugi.db') {
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (e) {
                // Ignore if failed (might be virtual path in tests)
            }
        }

        this.dbPath = dbPath;
        this.embeddingClient = new EmbeddingClient();
    }

    private async init() {
        if (this.db) return;

        // Load sql.js WASM
        // In node, we might need to locate the wasm file if not bundled
        // But usually initSqlJs() handles it or we pass locateFile
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
        if (!this.db) throw new Error('DB not initialized');

        this.db.run(`
      CREATE TABLE IF NOT EXISTS atoms (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        metadata TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Index for deduplication
      CREATE UNIQUE INDEX IF NOT EXISTS idx_content_hash 
      ON atoms(content_hash);
      
      -- Full-text search (not supported in standard sql.js build without FTS5 extension)
      -- We will skip FTS for now or use LIKE
      
      -- Track embedding costs
      CREATE TABLE IF NOT EXISTS embedding_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tokens INTEGER NOT NULL,
        cost REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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
     * Add atom to store (with deduplication)
     */
    async add(content: string, metadata: Partial<Atom['metadata']>): Promise<string> {
        await this.init();
        if (!this.db) throw new Error('DB init failed');

        // 1. Check for duplicate
        const contentHash = this.hashContent(content);

        const stmt = this.db.prepare(`SELECT id FROM atoms WHERE content_hash = :hash`);
        const existing = stmt.getAsObject({ ':hash': contentHash }) as { id: string } | undefined;
        stmt.free();

        if (existing && existing.id) {
            console.log('[VectorStore] Duplicate content detected, skipping');
            return existing.id;
        }

        // 2. Generate embedding
        const embeddingResult = await this.embeddingClient.embed(content);

        // 3. Track cost
        this.db.run(`
      INSERT INTO embedding_costs (tokens, cost)
      VALUES (?, ?)
    `, [embeddingResult.usage.tokens, embeddingResult.usage.cost]);

        // 4. Save atom
        const id = this.generateId();
        const fullMetadata = {
            source: 'unknown',
            timestamp: new Date(),
            ...metadata
        };

        this.db.run(`
      INSERT INTO atoms (id, content, embedding, metadata, content_hash)
      VALUES (?, ?, ?, ?, ?)
    `, [
            id,
            content,
            this.serializeEmbedding(embeddingResult.embedding),
            JSON.stringify(fullMetadata),
            contentHash
        ]);

        // Save to disk
        this.save();

        console.log('[VectorStore] Added atom:', {
            id,
            length: content.length,
            embeddingCost: embeddingResult.usage.cost
        });

        return id;
    }

    /**
     * Semantic search using cosine similarity
     */
    async search(query: string, limit = 10, minSimilarity = 0.5): Promise<SearchResult[]> {
        await this.init();
        if (!this.db) throw new Error('DB init failed');

        // 1. Generate query embedding
        const queryEmbedding = await this.embeddingClient.embed(query);

        // 2. Get all atoms (SCAN - slow for large datasets, but fine for prototype)
        const result = this.db.exec(`
      SELECT id, content, embedding, metadata, created_at
      FROM atoms
    `);

        if (result.length === 0) return [];

        const rows = result[0].values;
        const columns = result[0].columns;

        // Map helpful indices
        const idxId = columns.indexOf('id');
        const idxContent = columns.indexOf('content');
        const idxEmbedding = columns.indexOf('embedding');
        const idxMetadata = columns.indexOf('metadata');

        // 3. Calculate similarities
        const results: SearchResult[] = rows.map(row => {
            const embeddingBlob = row[idxEmbedding] as Uint8Array;
            const embedding = this.deserializeEmbedding(embeddingBlob);
            const similarity = EmbeddingClient.cosineSimilarity(
                queryEmbedding.embedding,
                embedding
            );

            return {
                id: row[idxId] as string,
                content: row[idxContent] as string,
                embedding,
                metadata: JSON.parse(row[idxMetadata] as string),
                similarity
            };
        });

        // 4. Sort by similarity and filter
        const filtered = results
            .filter(r => r.similarity >= minSimilarity)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return filtered;
    }

    /**
     * Hybrid search (semantic + keyword)
     * Note: Pure sql.js might miss FTS5, so we rely on LIKE or just Semantic for now.
     * Implementing simple LIKE fallback if FTS missing.
     */
    async hybridSearch(query: string, limit = 10): Promise<SearchResult[]> {
        await this.init();
        if (!this.db) throw new Error('DB init failed');

        // 1. Semantic search
        const semanticResults = await this.search(query, limit * 2);

        // 2. Keyword search (LIKE)
        const likeQuery = `%${query}%`;
        const result = this.db.exec(`
      SELECT 
        id, content, embedding, metadata, created_at
      FROM atoms 
      WHERE content LIKE '${likeQuery}' OR metadata LIKE '${likeQuery}'
      LIMIT ${limit}
    `);

        const keywordResults: SearchResult[] = [];
        if (result.length > 0) {
            const rows = result[0].values;
            const columns = result[0].columns;
            const idxId = columns.indexOf('id');
            const idxContent = columns.indexOf('content');
            const idxEmbedding = columns.indexOf('embedding');
            const idxMetadata = columns.indexOf('metadata');

            rows.forEach(row => {
                keywordResults.push({
                    id: row[idxId] as string,
                    content: row[idxContent] as string,
                    embedding: this.deserializeEmbedding(row[idxEmbedding] as Uint8Array),
                    metadata: JSON.parse(row[idxMetadata] as string),
                    similarity: 0.7
                });
            });
        }

        // 3. Merge and deduplicate
        const merged = new Map<string, SearchResult>();

        semanticResults.forEach(r => {
            merged.set(r.id, r);
        });

        keywordResults.forEach(r => {
            if (!merged.has(r.id)) {
                merged.set(r.id, r);
            }
        });

        return Array.from(merged.values())
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    /**
     * Get total embedding costs
     */
    async getEmbeddingCosts(): Promise<{ totalTokens: number; totalCost: number }> {
        await this.init();
        if (!this.db) throw new Error('DB init failed');

        const result = this.db.exec(`
      SELECT 
        SUM(tokens) as total_tokens,
        SUM(cost) as total_cost
      FROM embedding_costs
    `);

        if (result.length === 0 || result[0].values.length === 0) {
            return { totalTokens: 0, totalCost: 0 };
        }

        const row = result[0].values[0];
        return {
            totalTokens: (row[0] as number) || 0,
            totalCost: (row[1] as number) || 0
        };
    }

    /**
     * Serialize embedding to BLOB (Uint8Array for sql.js)
     */
    private serializeEmbedding(embedding: number[]): Uint8Array {
        return new Uint8Array(new Float32Array(embedding).buffer);
    }

    /**
     * Deserialize embedding from BLOB
     */
    private deserializeEmbedding(blob: Uint8Array): number[] {
        return Array.from(new Float32Array(blob.buffer));
    }

    /**
     * Hash content for deduplication
     */
    private hashContent(content: string): string {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `atom-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Close database
     */
    close() {
        if (this.db) {
            this.save();
            this.db.close();
            this.db = null;
        }
    }
}
