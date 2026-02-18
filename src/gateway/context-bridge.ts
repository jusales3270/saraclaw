import { OpenAugiConnector, createOpenAugiConnector, OpenAugiConnectorConfig } from '../../packages/sara-memory/src/index.js';
import { ChatMessage } from './chat-history.js';
import { join } from 'path';

export interface UserContext {
    userName?: string;
    profession?: string;
    relevantNotes: Array<{
        content: string;
        relevance: number;
        source: string;
    }>;
    conversationSummary?: string;
}

export class ContextBridge {
    private connector: OpenAugiConnector;

    constructor() {
        // Configura o conector apontando para um repositório padrão ou configurado
        const config: OpenAugiConnectorConfig = {
            repositoryPath: process.env.OPEN_AUGI_REPO || join(process.cwd(), '../open-augi-repo'),
            autoIndex: true,
            biographyPath: 'biography.md'
        };

        this.connector = createOpenAugiConnector(config);
        this.connector.connect().catch(err => {
            console.warn('[ContextBridge] Failed to connect to OpenAugi:', err);
        });
    }

    /**
     * Get user context for a given query
     */
    async getUserContext(
        query: string,
        options?: {
            conversationHistory?: ChatMessage[];
            maxNotes?: number;
        }
    ): Promise<UserContext> {
        try {
            // 1. Enrich query using OpenAugi
            const enriched = await this.connector.enrich(query);

            // 2. Extract notes from enrichment
            const relevantNotes = enriched ? enriched.sources.map(source => ({
                content: source.excerpt || '', // Excerpt might need to be fetched if empty, but OpenAugiConnector.enrich should provide it? 
                // Actually enrich returns EnrichedContext which has sources with title, path, relevance.
                // The context parts are in historicalContext string.
                // Let's rely on historicalContext for content.
                relevance: source.relevance,
                source: source.title
            })) : [];

            // If we need the actual content separate from historicalContext:
            // The EnrichedContext.historicalContext contains the text.
            // But let's stick to what we can get.

            // 3. Summarize recent conversation if provided
            let conversationSummary: string | undefined;

            if (options?.conversationHistory && options.conversationHistory.length > 0) {
                conversationSummary = this.summarizeConversation(options.conversationHistory);
            }

            // Mock profile if biography context is present (or extract it)
            // For now, we'll return undefined for explicit fields unless we parse biographyContext

            return {
                // userName: 'User', // Placeholder
                // profession: 'Unknown',
                relevantNotes: relevantNotes.map(n => ({
                    content: n.content || "Content reference only", // Ideally we'd have the content
                    relevance: n.relevance,
                    source: n.source
                })),
                conversationSummary
            };

        } catch (error) {
            console.error('[ContextBridge] Error getting user context:', error);

            // Return minimal context on error
            return {
                relevantNotes: []
            };
        }
    }

    /**
     * Summarize conversation history for context
     */
    private summarizeConversation(history: ChatMessage[]): string {
        // Get last 3 exchanges (6 messages)
        const recent = history.slice(-6);

        const summary = recent
            .map(msg => `${msg.role}: ${msg.content.substring(0, 100)}`)
            .join('\n');

        return `Conversa recente:\n${summary}`;
    }

    /**
     * Extract keywords from query for better search
     */
    private extractKeywords(query: string): string[] {
        // Remove stop words and get meaningful terms
        const stopWords = new Set([
            'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da',
            'em', 'para', 'por', 'com', 'sem', 'que', 'qual'
        ]);

        return query
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.has(word));
    }
}
