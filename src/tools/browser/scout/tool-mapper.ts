/**
 * Sara Scout - Tool Mapper
 * 
 * Parses WebMCP manifests into internal tool representations.
 * Provides intent-based tool matching and categorization.
 */

import type {
    WebMCPManifest,
    MCPTool,
} from './scout-types.js';

// ============================================
// CONSTANTS
// ============================================

/** Keywords that indicate a declarative (form-like) tool */
const DECLARATIVE_KEYWORDS = [
    'search', 'query', 'find', 'list', 'get', 'fetch',
    'filter', 'browse', 'lookup', 'check', 'view',
];

/** Keywords that indicate an imperative (action) tool */
const IMPERATIVE_KEYWORDS = [
    'create', 'add', 'submit', 'send', 'post', 'buy',
    'purchase', 'delete', 'remove', 'update', 'cancel',
    'book', 'reserve', 'order', 'pay', 'confirm',
    'upload', 'download', 'export', 'import',
];

// ============================================
// TOOL MAPPER
// ============================================

/**
 * Tool Mapper
 * 
 * Maps WebMCP manifest tools into structured internal representations
 * and provides intent-based fuzzy matching.
 */
export class ToolMapper {

    /**
     * Parse a WebMCP manifest into internal MCPTool representations.
     * Validates and enriches each tool with category information.
     */
    mapTools(manifest: WebMCPManifest): MCPTool[] {
        if (!manifest.tools || !Array.isArray(manifest.tools)) {
            return [];
        }

        return manifest.tools
            .filter(tool => this.isValidTool(tool))
            .map(tool => ({
                ...tool,
                category: tool.category || this.categorizeTool(tool),
                endpoint: this.resolveEndpoint(manifest.baseUrl, tool.endpoint),
                parameters: tool.parameters || [],
                tags: tool.tags || this.generateTags(tool),
            }));
    }

    /**
     * Find the best matching tool for a given intent string.
     * Uses multi-signal scoring: name match, description match, tag match.
     */
    findTool(tools: MCPTool[], intent: string): MCPTool | undefined {
        if (!tools.length || !intent) return undefined;

        const normalizedIntent = intent.toLowerCase().trim();
        const intentWords = normalizedIntent.split(/\s+/);

        let bestMatch: MCPTool | undefined;
        let bestScore = 0;

        for (const tool of tools) {
            let score = 0;

            // Exact name match (highest weight)
            if (tool.name.toLowerCase() === normalizedIntent.replace(/\s+/g, '_')) {
                score += 100;
            }

            // Partial name match
            const toolNameWords = tool.name.toLowerCase().split(/[_\-\s]+/);
            for (const word of intentWords) {
                if (toolNameWords.some(tw => tw.includes(word) || word.includes(tw))) {
                    score += 10;
                }
            }

            // Description match
            if (tool.description) {
                const descLower = tool.description.toLowerCase();
                for (const word of intentWords) {
                    if (word.length > 2 && descLower.includes(word)) {
                        score += 5;
                    }
                }
            }

            // Tag match
            if (tool.tags) {
                for (const tag of tool.tags) {
                    const tagLower = tag.toLowerCase();
                    for (const word of intentWords) {
                        if (tagLower.includes(word) || word.includes(tagLower)) {
                            score += 8;
                        }
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = tool;
            }
        }

        // Only return if score is above threshold
        return bestScore >= 5 ? bestMatch : undefined;
    }

    /**
     * Categorize a tool as either 'declarative' (query/form-like)
     * or 'imperative' (action/mutation).
     */
    categorizeTool(tool: MCPTool): 'declarative' | 'imperative' {
        const nameLower = tool.name.toLowerCase();
        const descLower = (tool.description || '').toLowerCase();
        const combined = `${nameLower} ${descLower}`;

        // Check method — GET requests are typically declarative
        if (tool.method === 'GET') return 'declarative';

        // Check for imperative keywords first (they're more specific)
        for (const keyword of IMPERATIVE_KEYWORDS) {
            if (combined.includes(keyword)) return 'imperative';
        }

        // Check for declarative keywords
        for (const keyword of DECLARATIVE_KEYWORDS) {
            if (combined.includes(keyword)) return 'declarative';
        }

        // Default: POST/PUT/DELETE are imperative, everything else declarative
        if (tool.method === 'POST' || tool.method === 'PUT' || tool.method === 'DELETE' || tool.method === 'PATCH') {
            return 'imperative';
        }

        return 'declarative';
    }

    /**
     * Get all tools that require user confirmation.
     */
    getConfirmationTools(tools: MCPTool[]): MCPTool[] {
        return tools.filter(t => t.requiresConfirmation || t.category === 'imperative');
    }

    /**
     * Generate a summary of mapped tools.
     */
    summarize(tools: MCPTool[]): string {
        if (!tools.length) return 'No tools available.';

        const declarative = tools.filter(t => t.category === 'declarative');
        const imperative = tools.filter(t => t.category === 'imperative');

        const lines = [
            `## Mapped Tools (${tools.length} total)`,
            '',
            `### Declarative (${declarative.length}):`,
            ...declarative.map(t => `- **${t.name}**: ${t.description} [${t.method}]`),
            '',
            `### Imperative (${imperative.length}):`,
            ...imperative.map(t => `- **${t.name}**: ${t.description} [${t.method}]${t.requiresConfirmation ? ' ⚠️ requires confirmation' : ''}`),
        ];

        return lines.join('\n');
    }

    // ============================================
    // HELPERS
    // ============================================

    /**
     * Validate that a tool has the minimum required fields.
     */
    private isValidTool(tool: Partial<MCPTool>): boolean {
        return !!(
            tool.name &&
            typeof tool.name === 'string' &&
            tool.endpoint &&
            typeof tool.endpoint === 'string' &&
            tool.method &&
            typeof tool.method === 'string'
        );
    }

    /**
     * Resolve a tool endpoint against the manifest base URL.
     */
    private resolveEndpoint(baseUrl: string, endpoint: string): string {
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
            return endpoint;
        }
        const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}${path}`;
    }

    /**
     * Auto-generate tags from tool name and description.
     */
    private generateTags(tool: MCPTool): string[] {
        const words = new Set<string>();

        // Split name on separators
        tool.name.toLowerCase().split(/[_\-\s]+/).forEach(w => {
            if (w.length > 2) words.add(w);
        });

        // Extract key words from description
        if (tool.description) {
            tool.description.toLowerCase().split(/\s+/).forEach(w => {
                const cleaned = w.replace(/[^a-z0-9]/g, '');
                if (cleaned.length > 3) words.add(cleaned);
            });
        }

        return Array.from(words).slice(0, 10);
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a ToolMapper instance.
 */
export function createToolMapper(): ToolMapper {
    return new ToolMapper();
}
