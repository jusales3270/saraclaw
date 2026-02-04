/**
 * Sara Tools - Content Filter
 * 
 * Filters and sanitizes web page content before sending to LLM.
 * Integrates with TheCensor to prevent sensitive data leakage.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================
// TYPES
// ============================================

/**
 * Browser policy loaded from JSON
 */
export interface BrowserPolicy {
    version: string;
    blocklist: {
        domains: string[];
        patterns: string[];
        fileExtensions: string[];
        reasons: Record<string, string>;
    };
    allowlist: {
        domains: string[];
        categories: string[];
    };
    contentRules: {
        maxPageSizeBytes: number;
        maxTextLength: number;
        stripScripts: boolean;
        stripStyles: boolean;
        stripComments: boolean;
        extractTextOnly: boolean;
        preserveLinks: boolean;
        preserveImages: boolean;
        preserveTables: boolean;
        timeout: {
            navigationMs: number;
            contentExtractionMs: number;
        };
        userAgent: string;
    };
    searchEngines: {
        primary: string;
        fallback: string[];
        preferPrivacy: boolean;
    };
    sensitiveDataPatterns: {
        block_if_detected: string[];
        warn_if_detected: string[];
    };
    rateLimit: {
        maxRequestsPerMinute: number;
        maxRequestsPerHour: number;
        cooldownAfterBlockMs: number;
    };
}

/**
 * URL check result
 */
export interface UrlCheckResult {
    allowed: boolean;
    reason?: string;
    isAllowlisted: boolean;
    isBlocklisted: boolean;
    matchedPattern?: string;
}

/**
 * Content filter result
 */
export interface ContentFilterResult {
    allowed: boolean;
    reason?: string;
    sanitizedContent: string;
    originalLength: number;
    sanitizedLength: number;
    sensitiveDataDetected: boolean;
    sensitivePatterns: string[];
    warnings: string[];
}

/**
 * Sensitive data detection result
 */
interface SensitiveDataCheck {
    hasBlockingData: boolean;
    hasWarningData: boolean;
    blockingPatterns: string[];
    warningPatterns: string[];
}

// ============================================
// CONTENT FILTER
// ============================================

/**
 * Content Filter for web pages
 * 
 * Checks URLs against policy and sanitizes content before LLM consumption.
 */
export class ContentFilter {
    private policy: BrowserPolicy;
    private blockedPatternRegexes: RegExp[];
    private sensitiveBlockRegexes: RegExp[];
    private sensitiveWarnRegexes: RegExp[];

    constructor(policy?: BrowserPolicy) {
        this.policy = policy || loadDefaultPolicy();

        // Pre-compile regexes for performance
        this.blockedPatternRegexes = this.policy.blocklist.patterns.map(
            p => this.patternToRegex(p)
        );

        this.sensitiveBlockRegexes = this.policy.sensitiveDataPatterns.block_if_detected.map(
            p => new RegExp(p, 'gi')
        );

        this.sensitiveWarnRegexes = this.policy.sensitiveDataPatterns.warn_if_detected.map(
            p => new RegExp(p, 'gi')
        );
    }

    /**
     * Convert glob-like pattern to regex
     */
    private patternToRegex(pattern: string): RegExp {
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(escaped, 'i');
    }

    /**
     * Check if a URL is allowed before fetching
     */
    checkUrl(url: string): UrlCheckResult {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();
            const fullUrl = url.toLowerCase();

            // Check file extension blocklist
            for (const ext of this.policy.blocklist.fileExtensions) {
                if (parsed.pathname.toLowerCase().endsWith(ext)) {
                    return {
                        allowed: false,
                        reason: `Blocked file extension: ${ext}`,
                        isAllowlisted: false,
                        isBlocklisted: true,
                        matchedPattern: ext,
                    };
                }
            }

            // Check domain blocklist
            for (const domain of this.policy.blocklist.domains) {
                if (hostname === domain || hostname.endsWith('.' + domain)) {
                    return {
                        allowed: false,
                        reason: this.policy.blocklist.reasons.social_media || `Blocked domain: ${domain}`,
                        isAllowlisted: false,
                        isBlocklisted: true,
                        matchedPattern: domain,
                    };
                }
            }

            // Check pattern blocklist
            for (let i = 0; i < this.blockedPatternRegexes.length; i++) {
                if (this.blockedPatternRegexes[i].test(fullUrl)) {
                    return {
                        allowed: false,
                        reason: this.policy.blocklist.reasons.auth_pages || 'Blocked by pattern',
                        isAllowlisted: false,
                        isBlocklisted: true,
                        matchedPattern: this.policy.blocklist.patterns[i],
                    };
                }
            }

            // Check allowlist (for informational purposes)
            let isAllowlisted = false;
            for (const domain of this.policy.allowlist.domains) {
                if (hostname === domain || hostname.endsWith('.' + domain)) {
                    isAllowlisted = true;
                    break;
                }
            }

            return {
                allowed: true,
                isAllowlisted,
                isBlocklisted: false,
            };

        } catch {
            return {
                allowed: false,
                reason: 'Invalid URL',
                isAllowlisted: false,
                isBlocklisted: true,
            };
        }
    }

    /**
     * Filter and sanitize page content
     */
    filterContent(html: string, url: string): ContentFilterResult {
        const warnings: string[] = [];
        const originalLength = html.length;

        // Check size limit
        if (html.length > this.policy.contentRules.maxPageSizeBytes) {
            return {
                allowed: false,
                reason: `Content exceeds size limit: ${html.length} > ${this.policy.contentRules.maxPageSizeBytes}`,
                sanitizedContent: '',
                originalLength,
                sanitizedLength: 0,
                sensitiveDataDetected: false,
                sensitivePatterns: [],
                warnings,
            };
        }

        // Strip scripts
        let sanitized = html;
        if (this.policy.contentRules.stripScripts) {
            sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
            sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');
        }

        // Strip styles
        if (this.policy.contentRules.stripStyles) {
            sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
            sanitized = sanitized.replace(/style="[^"]*"/gi, '');
        }

        // Strip comments
        if (this.policy.contentRules.stripComments) {
            sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
        }

        // Extract text only if configured
        if (this.policy.contentRules.extractTextOnly) {
            sanitized = this.extractText(sanitized);
        }

        // Check for sensitive data
        const sensitiveCheck = this.checkSensitiveData(sanitized);

        if (sensitiveCheck.hasBlockingData) {
            return {
                allowed: false,
                reason: `Sensitive data detected: ${sensitiveCheck.blockingPatterns.join(', ')}`,
                sanitizedContent: '',
                originalLength,
                sanitizedLength: 0,
                sensitiveDataDetected: true,
                sensitivePatterns: sensitiveCheck.blockingPatterns,
                warnings,
            };
        }

        if (sensitiveCheck.hasWarningData) {
            warnings.push(`Warning: Potential sensitive data found: ${sensitiveCheck.warningPatterns.join(', ')}`);
        }

        // Truncate if too long
        if (sanitized.length > this.policy.contentRules.maxTextLength) {
            sanitized = sanitized.slice(0, this.policy.contentRules.maxTextLength);
            warnings.push(`Content truncated to ${this.policy.contentRules.maxTextLength} characters`);
        }

        return {
            allowed: true,
            sanitizedContent: sanitized,
            originalLength,
            sanitizedLength: sanitized.length,
            sensitiveDataDetected: sensitiveCheck.hasWarningData,
            sensitivePatterns: sensitiveCheck.warningPatterns,
            warnings,
        };
    }

    /**
     * Extract readable text from HTML
     */
    private extractText(html: string): string {
        // Remove all tags except links and tables if preserving them
        let text = html;

        // Keep links if configured
        if (this.policy.contentRules.preserveLinks) {
            text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)');
        }

        // Remove all remaining HTML tags
        text = text.replace(/<[^>]+>/g, ' ');

        // Decode HTML entities
        text = text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

        // Normalize whitespace
        text = text.replace(/\s+/g, ' ').trim();

        return text;
    }

    /**
     * Check for sensitive data patterns
     */
    private checkSensitiveData(content: string): SensitiveDataCheck {
        const blockingPatterns: string[] = [];
        const warningPatterns: string[] = [];

        // Check blocking patterns
        for (let i = 0; i < this.sensitiveBlockRegexes.length; i++) {
            if (this.sensitiveBlockRegexes[i].test(content)) {
                blockingPatterns.push(this.policy.sensitiveDataPatterns.block_if_detected[i]);
            }
        }

        // Check warning patterns
        for (let i = 0; i < this.sensitiveWarnRegexes.length; i++) {
            if (this.sensitiveWarnRegexes[i].test(content)) {
                warningPatterns.push(this.policy.sensitiveDataPatterns.warn_if_detected[i]);
            }
        }

        return {
            hasBlockingData: blockingPatterns.length > 0,
            hasWarningData: warningPatterns.length > 0,
            blockingPatterns,
            warningPatterns,
        };
    }

    /**
     * Get search URL with preferred engine
     */
    getSearchUrl(query: string): string {
        const encodedQuery = encodeURIComponent(query);
        return `${this.policy.searchEngines.primary}${encodedQuery}`;
    }

    /**
     * Get timeout configurations
     */
    getTimeouts(): { navigationMs: number; contentExtractionMs: number } {
        return this.policy.contentRules.timeout;
    }

    /**
     * Get user agent string
     */
    getUserAgent(): string {
        return this.policy.contentRules.userAgent;
    }

    /**
     * Get policy summary
     */
    getSummary(): string {
        return [
            `ContentFilter Policy v${this.policy.version}:`,
            `  Blocked domains: ${this.policy.blocklist.domains.length}`,
            `  Blocked patterns: ${this.policy.blocklist.patterns.length}`,
            `  Allowed domains: ${this.policy.allowlist.domains.length}`,
            `  Max content size: ${this.policy.contentRules.maxPageSizeBytes} bytes`,
            `  Strip scripts: ${this.policy.contentRules.stripScripts}`,
        ].join('\n');
    }
}

// ============================================
// POLICY LOADER
// ============================================

/**
 * Load the default browser policy from JSON file
 */
export function loadDefaultPolicy(): BrowserPolicy {
    try {
        const currentDir = dirname(fileURLToPath(import.meta.url));
        const policyPath = join(currentDir, 'browser-policy.json');
        const content = readFileSync(policyPath, 'utf-8');
        return JSON.parse(content) as BrowserPolicy;
    } catch {
        // Return minimal fallback policy if file not found
        return getMinimalPolicy();
    }
}

/**
 * Get minimal fallback policy
 */
function getMinimalPolicy(): BrowserPolicy {
    return {
        version: '1.0.0-fallback',
        blocklist: {
            domains: ['facebook.com', 'twitter.com'],
            patterns: ['*login*', '*auth*'],
            fileExtensions: ['.exe', '.sh'],
            reasons: {},
        },
        allowlist: {
            domains: ['github.com', 'stackoverflow.com'],
            categories: ['documentation'],
        },
        contentRules: {
            maxPageSizeBytes: 5 * 1024 * 1024,
            maxTextLength: 50000,
            stripScripts: true,
            stripStyles: true,
            stripComments: true,
            extractTextOnly: false,
            preserveLinks: true,
            preserveImages: false,
            preserveTables: true,
            timeout: {
                navigationMs: 30000,
                contentExtractionMs: 10000,
            },
            userAgent: 'SaraClaw/1.0',
        },
        searchEngines: {
            primary: 'https://duckduckgo.com/?q=',
            fallback: [],
            preferPrivacy: true,
        },
        sensitiveDataPatterns: {
            block_if_detected: ['api[_-]?key', 'password'],
            warn_if_detected: ['email'],
        },
        rateLimit: {
            maxRequestsPerMinute: 30,
            maxRequestsPerHour: 200,
            cooldownAfterBlockMs: 60000,
        },
    };
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a new content filter
 */
export function createContentFilter(policy?: BrowserPolicy): ContentFilter {
    return new ContentFilter(policy);
}
