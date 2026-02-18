import { VectorStore, SearchResult } from './vector-store.js';

export class OpenAugiReader {
    private vectorStore: VectorStore;

    constructor(dbPath?: string) {
        this.vectorStore = new VectorStore(dbPath);
    }

    /**
     * Search notes using semantic search
     */
    async searchNotes(query: string, limit = 5): Promise<SearchResult[]> {
        return this.vectorStore.hybridSearch(query, limit);
    }

    /**
     * Get user profile (if exists)
     */
    async getUserProfile() {
        const results = await this.vectorStore.search('user profile name profession email', 1, 0.6);

        if (results.length === 0) {
            return null;
        }

        // Try to extract structured data from content
        const content = results[0].content;

        // Simple regex extraction (in production, use LLM to extract)
        const nameMatch = content.match(/name[:\s]+([^\n]+)/i);
        const professionMatch = content.match(/profession[:\s]+([^\n]+)/i);
        const emailMatch = content.match(/email[:\s]+([^\n]+)/i);

        return {
            name: nameMatch?.[1]?.trim() || 'User',
            profession: professionMatch?.[1]?.trim() || 'Unknown',
            email: emailMatch?.[1]?.trim()
        };
    }

    /**
     * Get embedding costs
     */
    getEmbeddingCosts() {
        return this.vectorStore.getEmbeddingCosts();
    }
}
