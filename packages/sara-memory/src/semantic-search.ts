/**
 * Sara Memory - Semantic Search
 * 
 * Semantic search implementation against the Markdown/Knowledge Graph repository.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Search result from semantic query
 */
export interface SemanticSearchResult {
    /** Path to the matching file */
    filePath: string;

    /** File title (from frontmatter or first heading) */
    title: string;

    /** Relevant excerpt */
    excerpt: string;

    /** Relevance score (0-1) */
    score: number;

    /** Matched keywords */
    matchedKeywords: string[];

    /** Tags from the document */
    tags: string[];
}

/**
 * Document metadata from frontmatter
 */
export interface DocumentMetadata {
    title?: string;
    tags?: string[];
    date?: string;
    category?: string;
    [key: string]: unknown;
}

/**
 * Parsed markdown document
 */
export interface ParsedDocument {
    /** File path */
    path: string;

    /** Frontmatter metadata */
    metadata: DocumentMetadata;

    /** Document content (without frontmatter) */
    content: string;

    /** Extracted headings */
    headings: string[];

    /** Word frequency map */
    wordFrequency: Map<string, number>;
}

/**
 * Semantic Search Engine
 */
export class SemanticSearch {
    private documents: Map<string, ParsedDocument> = new Map();
    private indexedKeywords: Map<string, Set<string>> = new Map(); // keyword -> file paths

    /**
     * Index a markdown file
     */
    indexFile(filePath: string): void {
        if (!existsSync(filePath)) {
            console.warn(`[SemanticSearch] File not found: ${filePath}`);
            return;
        }

        const content = readFileSync(filePath, 'utf-8');
        const parsed = this.parseMarkdown(filePath, content);

        this.documents.set(filePath, parsed);

        // Index keywords
        for (const [word] of parsed.wordFrequency) {
            if (!this.indexedKeywords.has(word)) {
                this.indexedKeywords.set(word, new Set());
            }
            this.indexedKeywords.get(word)!.add(filePath);
        }
    }

    /**
     * Parse a markdown file
     */
    private parseMarkdown(filePath: string, content: string): ParsedDocument {
        let metadata: DocumentMetadata = {};
        let bodyContent = content;

        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        if (frontmatterMatch) {
            metadata = this.parseFrontmatter(frontmatterMatch[1]);
            bodyContent = content.slice(frontmatterMatch[0].length);
        }

        // Extract headings
        const headings: string[] = [];
        const headingRegex = /^#{1,6}\s+(.+)$/gm;
        let match;
        while ((match = headingRegex.exec(bodyContent)) !== null) {
            headings.push(match[1]);
        }

        // Build word frequency
        const wordFrequency = this.buildWordFrequency(bodyContent);

        // Get title from metadata or first heading
        if (!metadata.title && headings.length > 0) {
            metadata.title = headings[0];
        }

        return {
            path: filePath,
            metadata,
            content: bodyContent,
            headings,
            wordFrequency,
        };
    }

    /**
     * Parse YAML frontmatter (simple parser)
     */
    private parseFrontmatter(yaml: string): DocumentMetadata {
        const metadata: DocumentMetadata = {};

        const lines = yaml.split('\n');
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;

            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();

            // Handle arrays (simple format: [item1, item2])
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1);
                metadata[key] = value.split(',').map(s => s.trim());
            } else {
                // Remove quotes
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                metadata[key] = value;
            }
        }

        return metadata;
    }

    /**
     * Build word frequency map from text
     */
    private buildWordFrequency(text: string): Map<string, number> {
        const frequency = new Map<string, number>();
        const stopWords = new Set([
            'a', 'o', 'e', 'de', 'da', 'do', 'que', 'em', 'para', 'um', 'uma', 'com', 'não',
            'the', 'is', 'are', 'to', 'and', 'of', 'in', 'for', 'on', 'with', 'as', 'be',
        ]);

        const words = text.toLowerCase()
            .replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));

        for (const word of words) {
            frequency.set(word, (frequency.get(word) || 0) + 1);
        }

        return frequency;
    }

    /**
     * Search for documents matching a query
     */
    search(query: string, limit: number = 10): SemanticSearchResult[] {
        const queryWords = query.toLowerCase()
            .replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);

        if (queryWords.length === 0) {
            return [];
        }

        // Find candidate documents
        const candidateScores = new Map<string, { score: number; matches: string[] }>();

        for (const word of queryWords) {
            // Exact match
            const exactMatches = this.indexedKeywords.get(word);
            if (exactMatches) {
                for (const path of exactMatches) {
                    const current = candidateScores.get(path) || { score: 0, matches: [] };
                    const doc = this.documents.get(path)!;
                    const tf = doc.wordFrequency.get(word) || 0;
                    current.score += tf;
                    current.matches.push(word);
                    candidateScores.set(path, current);
                }
            }

            // Prefix match
            for (const [indexedWord, paths] of this.indexedKeywords) {
                if (indexedWord.startsWith(word) && indexedWord !== word) {
                    for (const path of paths) {
                        const current = candidateScores.get(path) || { score: 0, matches: [] };
                        current.score += 0.5; // Lower weight for prefix matches
                        if (!current.matches.includes(word)) {
                            current.matches.push(word);
                        }
                        candidateScores.set(path, current);
                    }
                }
            }
        }

        // Convert to results
        const results: SemanticSearchResult[] = [];

        for (const [path, { score, matches }] of candidateScores) {
            const doc = this.documents.get(path)!;

            // Normalize score
            const normalizedScore = Math.min(1, score / (queryWords.length * 10));

            // Extract excerpt around first match
            const excerpt = this.extractExcerpt(doc.content, matches[0]);

            results.push({
                filePath: path,
                title: doc.metadata.title || path.split('/').pop() || 'Untitled',
                excerpt,
                score: normalizedScore,
                matchedKeywords: matches,
                tags: (doc.metadata.tags as string[]) || [],
            });
        }

        // Sort by score and limit
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Extract an excerpt around a keyword
     */
    private extractExcerpt(content: string, keyword: string, contextChars: number = 150): string {
        const lowerContent = content.toLowerCase();
        const index = lowerContent.indexOf(keyword.toLowerCase());

        if (index === -1) {
            return content.slice(0, contextChars * 2) + '...';
        }

        const start = Math.max(0, index - contextChars);
        const end = Math.min(content.length, index + keyword.length + contextChars);

        let excerpt = content.slice(start, end);

        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';

        return excerpt;
    }

    /**
     * Get document count
     */
    getDocumentCount(): number {
        return this.documents.size;
    }

    /**
     * Get keyword count
     */
    getKeywordCount(): number {
        return this.indexedKeywords.size;
    }

    /**
     * Clear the index
     */
    clear(): void {
        this.documents.clear();
        this.indexedKeywords.clear();
    }
}

/**
 * Create a new semantic search instance
 */
export function createSemanticSearch(): SemanticSearch {
    return new SemanticSearch();
}
