/**
 * Sara Memory - Context Enricher
 * 
 * Pre-response context enrichment using user biography and historical data.
 */

import { SemanticSearch, SemanticSearchResult, createSemanticSearch } from './semantic-search.js';
import { glob } from 'glob';
import { join, resolve } from 'path';

/**
 * Enriched context for a query
 */
export interface EnrichedContext {
    /** Original query */
    query: string;

    /** Relevant historical context */
    historicalContext: string;

    /** Source documents used */
    sources: {
        title: string;
        path: string;
        relevance: number;
    }[];

    /** Biography snippets if available */
    biographyContext?: string;

    /** Related topics detected */
    relatedTopics: string[];

    /** Timestamp of enrichment */
    enrichedAt: Date;
}

/**
 * Context Enricher configuration
 */
export interface ContextEnricherConfig {
    /** Path to the OpenAugi repository */
    repositoryPath: string;

    /** Maximum context tokens to include */
    maxContextTokens: number;

    /** Maximum number of sources to include */
    maxSources: number;

    /** Path patterns to include (glob) */
    includePatterns: string[];

    /** Path patterns to exclude (glob) */
    excludePatterns: string[];

    /** Biography file path (relative to repository) */
    biographyPath?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_ENRICHER_CONFIG: Partial<ContextEnricherConfig> = {
    maxContextTokens: 2000,
    maxSources: 5,
    includePatterns: ['**/*.md'],
    excludePatterns: ['**/node_modules/**', '**/.git/**'],
};

/**
 * Context Enricher
 * 
 * Enriches queries with relevant historical context from the knowledge graph.
 */
export class ContextEnricher {
    private config: ContextEnricherConfig;
    private search: SemanticSearch;
    private isIndexed: boolean = false;
    private biographyContent: string | null = null;

    constructor(config: ContextEnricherConfig) {
        this.config = { ...DEFAULT_ENRICHER_CONFIG, ...config } as ContextEnricherConfig;
        this.search = createSemanticSearch();
    }

    /**
     * Index the OpenAugi repository
     */
    async indexRepository(): Promise<{ filesIndexed: number; duration: number }> {
        const startTime = Date.now();

        const repoPath = resolve(this.config.repositoryPath);

        // Find all markdown files
        const files = await glob(this.config.includePatterns, {
            cwd: repoPath,
            ignore: this.config.excludePatterns,
            absolute: true,
        });

        console.log(`[ContextEnricher] Indexing ${files.length} files from ${repoPath}`);

        for (const file of files) {
            try {
                this.search.indexFile(file);
            } catch (error) {
                console.warn(`[ContextEnricher] Failed to index ${file}:`, error);
            }
        }

        // Load biography if configured
        if (this.config.biographyPath) {
            const bioPath = join(repoPath, this.config.biographyPath);
            try {
                const { readFileSync, existsSync } = await import('fs');
                if (existsSync(bioPath)) {
                    this.biographyContent = readFileSync(bioPath, 'utf-8');
                    console.log('[ContextEnricher] Biography loaded');
                }
            } catch (error) {
                console.warn('[ContextEnricher] Failed to load biography:', error);
            }
        }

        this.isIndexed = true;

        return {
            filesIndexed: files.length,
            duration: Date.now() - startTime,
        };
    }

    /**
     * Enrich a query with historical context
     */
    async enrich(query: string): Promise<EnrichedContext> {
        if (!this.isIndexed) {
            console.warn('[ContextEnricher] Repository not indexed, attempting to index now');
            await this.indexRepository();
        }

        // Search for relevant documents
        const results = this.search.search(query, this.config.maxSources);

        // Build historical context
        const contextParts: string[] = [];
        const sources: EnrichedContext['sources'] = [];
        let tokenEstimate = 0;

        for (const result of results) {
            // Rough token estimate (1 token ≈ 4 chars)
            const excerptTokens = Math.ceil(result.excerpt.length / 4);

            if (tokenEstimate + excerptTokens > this.config.maxContextTokens) {
                break;
            }

            contextParts.push(`### ${result.title}\n${result.excerpt}`);
            sources.push({
                title: result.title,
                path: result.filePath,
                relevance: result.score,
            });

            tokenEstimate += excerptTokens;
        }

        // Extract related topics from results
        const relatedTopics = this.extractRelatedTopics(results);

        // Build biography context if available and relevant
        let biographyContext: string | undefined;
        if (this.biographyContent) {
            biographyContext = this.extractRelevantBiography(query);
        }

        return {
            query,
            historicalContext: contextParts.join('\n\n'),
            sources,
            biographyContext,
            relatedTopics,
            enrichedAt: new Date(),
        };
    }

    /**
     * Extract related topics from search results
     */
    private extractRelatedTopics(results: SemanticSearchResult[]): string[] {
        const topicCounts = new Map<string, number>();

        for (const result of results) {
            // Add tags as topics
            for (const tag of result.tags) {
                topicCounts.set(tag, (topicCounts.get(tag) || 0) + result.score);
            }

            // Add matched keywords as topics
            for (const keyword of result.matchedKeywords) {
                topicCounts.set(keyword, (topicCounts.get(keyword) || 0) + result.score * 0.5);
            }
        }

        // Sort by count and return top topics
        return Array.from(topicCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([topic]) => topic);
    }

    /**
     * Extract relevant biography snippets
     */
    private extractRelevantBiography(query: string): string | undefined {
        if (!this.biographyContent) return undefined;

        const queryWords = query.toLowerCase().split(/\s+/);
        const paragraphs = this.biographyContent.split(/\n\n+/);

        const relevantParagraphs: { text: string; score: number }[] = [];

        for (const para of paragraphs) {
            if (para.trim().length < 20) continue;

            const lowerPara = para.toLowerCase();
            let score = 0;

            for (const word of queryWords) {
                if (word.length > 2 && lowerPara.includes(word)) {
                    score += 1;
                }
            }

            if (score > 0) {
                relevantParagraphs.push({ text: para, score });
            }
        }

        if (relevantParagraphs.length === 0) return undefined;

        // Return top 2 paragraphs
        return relevantParagraphs
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)
            .map(p => p.text)
            .join('\n\n');
    }

    /**
     * Get indexing statistics
     */
    getStats(): { documents: number; keywords: number; isIndexed: boolean } {
        return {
            documents: this.search.getDocumentCount(),
            keywords: this.search.getKeywordCount(),
            isIndexed: this.isIndexed,
        };
    }

    /**
     * Check if biography is loaded
     */
    hasBiography(): boolean {
        return this.biographyContent !== null;
    }

    /**
     * Re-index the repository
     */
    async reindex(): Promise<void> {
        this.search.clear();
        this.biographyContent = null;
        this.isIndexed = false;
        await this.indexRepository();
    }
}

/**
 * Create a new context enricher
 */
export function createContextEnricher(config: ContextEnricherConfig): ContextEnricher {
    return new ContextEnricher(config);
}
