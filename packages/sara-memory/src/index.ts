/**
 * Sara Memory - OpenAugi Connector
 * 
 * Main connector for the OpenAugi knowledge graph.
 */

import { ContextEnricher, createContextEnricher, EnrichedContext, ContextEnricherConfig } from './context-enricher.js';
import { SemanticSearch, createSemanticSearch, SemanticSearchResult } from './semantic-search.js';

/**
 * OpenAugi connector configuration
 */
export interface OpenAugiConnectorConfig {
    /** Path to the OpenAugi repository */
    repositoryPath: string;

    /** Enable automatic indexing on connection */
    autoIndex: boolean;

    /** Path to biography file (relative to repository) */
    biographyPath?: string;

    /** Maximum context tokens for enrichment */
    maxContextTokens?: number;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
    /** Whether connected to the repository */
    connected: boolean;

    /** Repository path */
    repositoryPath: string;

    /** Number of indexed documents */
    documentsIndexed: number;

    /** Whether biography is available */
    hasBiography: boolean;

    /** Last index time */
    lastIndexed?: Date;

    /** Error message if connection failed */
    error?: string;
}

/**
 * OpenAugi Connector
 * 
 * Main interface for integrating with the OpenAugi knowledge graph.
 */
export class OpenAugiConnector {
    private config: OpenAugiConnectorConfig;
    private enricher: ContextEnricher | null = null;
    private lastIndexed: Date | null = null;
    private connectionError: string | null = null;

    constructor(config: OpenAugiConnectorConfig) {
        this.config = config;
    }

    /**
     * Connect to the OpenAugi repository
     */
    async connect(): Promise<ConnectionStatus> {
        try {
            const { existsSync } = await import('fs');
            const { resolve } = await import('path');

            const repoPath = resolve(this.config.repositoryPath);

            // Check if repository exists
            if (!existsSync(repoPath)) {
                this.connectionError = `Repository not found: ${repoPath}`;
                return this.getStatus();
            }

            // Create enricher
            this.enricher = createContextEnricher({
                repositoryPath: repoPath,
                maxContextTokens: this.config.maxContextTokens || 2000,
                maxSources: 5,
                includePatterns: ['**/*.md'],
                excludePatterns: ['**/node_modules/**', '**/.git/**'],
                biographyPath: this.config.biographyPath,
            });

            // Auto-index if configured
            if (this.config.autoIndex) {
                await this.index();
            }

            this.connectionError = null;
            return this.getStatus();

        } catch (error) {
            this.connectionError = error instanceof Error ? error.message : String(error);
            return this.getStatus();
        }
    }

    /**
     * Index the repository
     */
    async index(): Promise<{ filesIndexed: number; duration: number }> {
        if (!this.enricher) {
            throw new Error('Not connected. Call connect() first.');
        }

        const result = await this.enricher.indexRepository();
        this.lastIndexed = new Date();

        console.log(`[OpenAugi] Indexed ${result.filesIndexed} files in ${result.duration}ms`);

        return result;
    }

    /**
     * Enrich a query with historical context
     */
    async enrich(query: string): Promise<EnrichedContext | null> {
        if (!this.enricher) {
            console.warn('[OpenAugi] Not connected, cannot enrich');
            return null;
        }

        return this.enricher.enrich(query);
    }

    /**
     * Search the knowledge graph
     */
    async search(query: string, limit?: number): Promise<SemanticSearchResult[]> {
        if (!this.enricher) {
            console.warn('[OpenAugi] Not connected, cannot search');
            return [];
        }

        // Access internal search through enricher
        const enriched = await this.enricher.enrich(query);

        // Convert sources to search results format
        return enriched.sources.map(source => ({
            filePath: source.path,
            title: source.title,
            excerpt: '',
            score: source.relevance,
            matchedKeywords: [],
            tags: [],
        }));
    }

    /**
     * Get connection status
     */
    getStatus(): ConnectionStatus {
        const stats = this.enricher?.getStats();

        return {
            connected: this.enricher !== null && !this.connectionError,
            repositoryPath: this.config.repositoryPath,
            documentsIndexed: stats?.documents || 0,
            hasBiography: this.enricher?.hasBiography() || false,
            lastIndexed: this.lastIndexed || undefined,
            error: this.connectionError || undefined,
        };
    }

    /**
     * Disconnect from the repository
     */
    disconnect(): void {
        this.enricher = null;
        this.lastIndexed = null;
        this.connectionError = null;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.enricher !== null && !this.connectionError;
    }
}

/**
 * Create a new OpenAugi connector
 */
export function createOpenAugiConnector(config: OpenAugiConnectorConfig): OpenAugiConnector {
    return new OpenAugiConnector(config);
}

// Re-export types and utilities
export * from './semantic-search.js';
export * from './context-enricher.js';
export * from './writer.js';
