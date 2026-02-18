import OpenAI from 'openai';

export interface EmbeddingResult {
    embedding: number[];
    model: string;
    usage: {
        tokens: number;
        cost: number;
    };
}

/**
 * Client for generating text embeddings
 * Uses OpenAI text-embedding-3-small ($0.02 per 1M tokens)
 */
export class EmbeddingClient {
    private openai: OpenAI;
    private readonly MODEL = 'text-embedding-3-small';
    private readonly COST_PER_1M_TOKENS = 0.02;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required for embeddings');
        }

        this.openai = new OpenAI({ apiKey });
    }

    /**
     * Generate embedding for a single text
     */
    async embed(text: string): Promise<EmbeddingResult> {
        try {
            const response = await this.openai.embeddings.create({
                model: this.MODEL,
                input: text,
                encoding_format: 'float'
            });

            const embedding = response.data[0].embedding;
            const tokens = response.usage.total_tokens;
            const cost = (tokens / 1_000_000) * this.COST_PER_1M_TOKENS;

            return {
                embedding,
                model: this.MODEL,
                usage: { tokens, cost }
            };

        } catch (error: any) {
            console.error('[EmbeddingClient] Error generating embedding:', error);
            throw new Error(`Embedding failed: ${error.message}`);
        }
    }

    /**
     * Generate embeddings for multiple texts (batched)
     */
    async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
        // OpenAI allows up to 2048 inputs per request
        const BATCH_SIZE = 2048;
        const results: EmbeddingResult[] = [];

        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);

            const response = await this.openai.embeddings.create({
                model: this.MODEL,
                input: batch,
                encoding_format: 'float'
            });

            const tokens = response.usage.total_tokens;
            const cost = (tokens / 1_000_000) * this.COST_PER_1M_TOKENS;

            const batchResults = response.data.map((item, idx) => ({
                embedding: item.embedding,
                model: this.MODEL,
                usage: {
                    tokens: Math.floor(tokens / batch.length), // Approximate
                    cost: cost / batch.length
                }
            }));

            results.push(...batchResults);
        }

        return results;
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    static cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Embeddings must have same dimension');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
