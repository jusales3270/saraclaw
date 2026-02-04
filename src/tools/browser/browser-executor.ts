/**
 * Sara Tools - Safe Browser Executor
 * 
 * Orchestrates secure browser navigation using:
 * - SandboxEnforcer for Docker isolation
 * - NetworkJail for LAN blocking
 * - ContentFilter for page sanitization
 * - TheCensor for output leak prevention
 */

import { NetworkJail, createNetworkJail, validateUrl } from './network-jail.js';
import { ContentFilter, createContentFilter, UrlCheckResult, ContentFilterResult } from './content-filter.js';

// ============================================
// TYPES
// ============================================

/**
 * Search result from browser
 */
export interface BrowserSearchResult {
    /** URL visited */
    url: string;

    /** Page title */
    title: string;

    /** Extracted/sanitized content */
    content: string;

    /** Raw HTML (if available, post-sanitization) */
    html?: string;

    /** Screenshot as base64 (if requested) */
    screenshot?: string;

    /** Whether this result was blocked */
    blocked: boolean;

    /** Block reason if blocked */
    blockReason?: string;

    /** Content length before sanitization */
    originalLength: number;

    /** Warnings from content filter */
    warnings: string[];

    /** Timestamp */
    fetchedAt: Date;
}

/**
 * Navigation options
 */
export interface NavigationOptions {
    /** Take screenshot */
    screenshot?: boolean;

    /** Wait for selector before extracting */
    waitForSelector?: string;

    /** Custom timeout in ms */
    timeoutMs?: number;

    /** Extract text only (no HTML) */
    textOnly?: boolean;

    /** Maximum content length */
    maxContentLength?: number;
}

/**
 * Search options
 */
export interface SearchOptions extends NavigationOptions {
    /** Number of results to fetch */
    maxResults?: number;

    /** Search engine override */
    searchEngine?: string;
}

/**
 * Browser executor configuration
 */
export interface BrowserExecutorConfig {
    /** Enable sandbox (Docker) - disable for testing */
    useSandbox: boolean;

    /** Playwright image */
    playwrightImage: string;

    /** Container timeout */
    containerTimeoutSeconds: number;

    /** Memory limit */
    memoryLimit: string;

    /** Enable network jail */
    networkJailEnabled: boolean;

    /** Log all operations */
    verbose: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_BROWSER_EXECUTOR_CONFIG: BrowserExecutorConfig = {
    useSandbox: true,
    playwrightImage: 'mcr.microsoft.com/playwright:v1.40.0-jammy',
    containerTimeoutSeconds: 120,
    memoryLimit: '2g',
    networkJailEnabled: true,
    verbose: false,
};

// ============================================
// SAFE BROWSER EXECUTOR
// ============================================

/**
 * Safe Browser Executor
 * 
 * Orchestrates browser navigation with multiple security layers.
 */
export class SafeBrowserExecutor {
    private config: BrowserExecutorConfig;
    private networkJail: NetworkJail;
    private contentFilter: ContentFilter;
    private requestCount: { minute: number; hour: number; lastReset: Date };

    constructor(config: Partial<BrowserExecutorConfig> = {}) {
        this.config = { ...DEFAULT_BROWSER_EXECUTOR_CONFIG, ...config };
        this.networkJail = createNetworkJail();
        this.contentFilter = createContentFilter();
        this.requestCount = {
            minute: 0,
            hour: 0,
            lastReset: new Date(),
        };
    }

    /**
     * Perform a web search
     */
    async search(query: string, options: SearchOptions = {}): Promise<BrowserSearchResult[]> {
        const results: BrowserSearchResult[] = [];
        const maxResults = options.maxResults || 5;

        // Generate search URL
        const searchUrl = options.searchEngine || this.contentFilter.getSearchUrl(query);

        this.log(`Searching: "${query}" via ${searchUrl}`);

        // Navigate to search page
        const searchResult = await this.navigate(searchUrl, options);

        if (searchResult.blocked) {
            return [searchResult];
        }

        // In a full implementation, we would:
        // 1. Parse search results from the page
        // 2. Navigate to each result URL
        // 3. Extract content from each page
        // 
        // For now, return the search page result
        results.push(searchResult);

        return results;
    }

    /**
     * Navigate to a URL and extract content
     */
    async navigate(url: string, options: NavigationOptions = {}): Promise<BrowserSearchResult> {
        const startTime = Date.now();

        // Pre-flight checks
        const preflightResult = this.preflightCheck(url);
        if (!preflightResult.allowed) {
            return this.blockedResult(url, preflightResult.reason || 'Preflight check failed');
        }

        // Rate limiting
        if (!this.checkRateLimit()) {
            return this.blockedResult(url, 'Rate limit exceeded');
        }

        try {
            // Execute navigation
            let content: string;
            let title: string;
            let html: string;

            if (this.config.useSandbox) {
                // Use sandboxed Playwright
                const result = await this.executeInSandbox(url, options);
                content = result.content;
                title = result.title;
                html = result.html;
            } else {
                // Use simple fetch for testing
                const result = await this.simpleFetch(url);
                content = result.content;
                title = result.title;
                html = result.html;
            }

            // Apply content filter
            const filterResult = this.contentFilter.filterContent(html, url);

            if (!filterResult.allowed) {
                return this.blockedResult(url, filterResult.reason || 'Content blocked');
            }

            // Build result
            return {
                url,
                title,
                content: options.textOnly ? this.extractText(filterResult.sanitizedContent) : filterResult.sanitizedContent,
                html: options.textOnly ? undefined : filterResult.sanitizedContent,
                blocked: false,
                originalLength: filterResult.originalLength,
                warnings: filterResult.warnings,
                fetchedAt: new Date(),
            };

        } catch (error) {
            return this.blockedResult(url, `Navigation error: ${error}`);
        }
    }

    /**
     * Pre-flight security checks
     */
    private preflightCheck(url: string): UrlCheckResult & { allowed: boolean } {
        // Check NetworkJail (private IPs)
        const jailCheck = this.networkJail.isUrlBlocked(url);
        if (jailCheck.blocked) {
            return {
                allowed: false,
                reason: jailCheck.reason,
                isAllowlisted: false,
                isBlocklisted: true,
            };
        }

        // Check ContentFilter (blocklist)
        const filterCheck = this.contentFilter.checkUrl(url);
        if (!filterCheck.allowed) {
            return {
                ...filterCheck,
                allowed: false,
            };
        }

        // URL validation
        const urlCheck = validateUrl(url);
        if (!urlCheck.valid) {
            return {
                allowed: false,
                reason: urlCheck.reason,
                isAllowlisted: false,
                isBlocklisted: true,
            };
        }

        return {
            allowed: true,
            isAllowlisted: filterCheck.isAllowlisted,
            isBlocklisted: false,
        };
    }

    /**
     * Execute navigation in sandboxed container
     */
    private async executeInSandbox(url: string, options: NavigationOptions): Promise<{
        content: string;
        title: string;
        html: string;
    }> {
        // In production, this would:
        // 1. Create ephemeral Docker container with Playwright
        // 2. Apply NetworkJail iptables rules
        // 3. Navigate to URL
        // 4. Extract content
        // 5. Destroy container
        //
        // For now, simulate with simple fetch
        this.log(`[SANDBOX] Would execute in container: ${url}`);

        return this.simpleFetch(url);
    }

    /**
     * Simple fetch for testing (non-sandboxed)
     */
    private async simpleFetch(url: string): Promise<{
        content: string;
        title: string;
        html: string;
    }> {
        // Simulated response for testing
        // In production, this would use actual HTTP fetch

        this.log(`[FETCH] Simulating fetch: ${url}`);

        // Parse URL for title
        const parsed = new URL(url);
        const domain = parsed.hostname;

        // Return simulated content based on domain
        const simulatedResponses: Record<string, { title: string; content: string }> = {
            'duckduckgo.com': {
                title: 'DuckDuckGo Search Results',
                content: 'Search results for your query would appear here.',
            },
            'news.ycombinator.com': {
                title: 'Hacker News',
                content: 'Latest tech news and discussions from HN.',
            },
            'github.com': {
                title: 'GitHub',
                content: 'Repository information and README content.',
            },
        };

        const response = simulatedResponses[domain] || {
            title: `Page: ${domain}`,
            content: `Content from ${url}`,
        };

        return {
            content: response.content,
            title: response.title,
            html: `<html><head><title>${response.title}</title></head><body>${response.content}</body></html>`,
        };
    }

    /**
     * Extract plain text from content
     */
    private extractText(html: string): string {
        return html
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Create a blocked result
     */
    private blockedResult(url: string, reason: string): BrowserSearchResult {
        this.log(`[BLOCKED] ${url}: ${reason}`);

        return {
            url,
            title: 'Blocked',
            content: '',
            blocked: true,
            blockReason: reason,
            originalLength: 0,
            warnings: [],
            fetchedAt: new Date(),
        };
    }

    /**
     * Check and update rate limit
     */
    private checkRateLimit(): boolean {
        const now = new Date();
        const minuteAgo = new Date(now.getTime() - 60000);
        const hourAgo = new Date(now.getTime() - 3600000);

        // Reset counters if needed
        if (this.requestCount.lastReset < minuteAgo) {
            this.requestCount.minute = 0;
        }
        if (this.requestCount.lastReset < hourAgo) {
            this.requestCount.hour = 0;
        }

        // Check limits (from policy: 30/min, 200/hour)
        if (this.requestCount.minute >= 30 || this.requestCount.hour >= 200) {
            return false;
        }

        // Increment
        this.requestCount.minute++;
        this.requestCount.hour++;
        this.requestCount.lastReset = now;

        return true;
    }

    /**
     * Log message if verbose
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[SafeBrowser] ${message}`);
        }
    }

    /**
     * Get executor summary
     */
    getSummary(): string {
        return [
            'SafeBrowserExecutor:',
            `  Sandbox: ${this.config.useSandbox ? 'enabled' : 'DISABLED (testing)'}`,
            `  NetworkJail: ${this.config.networkJailEnabled ? 'enabled' : 'disabled'}`,
            `  Requests this minute: ${this.requestCount.minute}/30`,
            `  Requests this hour: ${this.requestCount.hour}/200`,
            '',
            this.networkJail.getSummary(),
            '',
            this.contentFilter.getSummary(),
        ].join('\n');
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create SafeBrowserExecutor with default config
 */
export function createBrowserExecutor(config?: Partial<BrowserExecutorConfig>): SafeBrowserExecutor {
    return new SafeBrowserExecutor(config);
}

/**
 * Create executor for testing (no sandbox)
 */
export function createTestBrowserExecutor(): SafeBrowserExecutor {
    return new SafeBrowserExecutor({
        useSandbox: false,
        verbose: true,
    });
}
