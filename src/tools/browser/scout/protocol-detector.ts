/**
 * Sara Scout - Protocol Detector
 * 
 * Detects WebMCP manifest support on websites through multiple methods:
 * 1. HTTP response headers (X-MCP-Manifest, Link rel="mcp-manifest")
 * 2. Well-known endpoint (/.well-known/mcp.json)
 * 3. HTML meta tag (<meta name="mcp-manifest">)
 * 
 * Results are cached per-origin with configurable TTL.
 */

import { EventEmitter } from 'events';
import type {
    WebMCPManifest,
    ProtocolDetectionResult,
    CachedDetection,
    DetectionMethod,
    ScoutConfig,
} from './scout-types.js';
import { DEFAULT_SCOUT_CONFIG } from './scout-types.js';

// ============================================
// CONSTANTS
// ============================================

/** HTTP header names to check for MCP manifest */
const MCP_HEADER_NAMES = ['x-mcp-manifest', 'x-webmcp-manifest'];

/** Link header rel value for MCP manifest */
const MCP_LINK_REL = 'mcp-manifest';

/** Well-known endpoint for MCP manifest */
const WELL_KNOWN_PATH = '/.well-known/mcp.json';

/** HTML meta tag name for MCP manifest */
const META_TAG_NAME = 'mcp-manifest';

// ============================================
// PROTOCOL DETECTOR
// ============================================

/**
 * Protocol Detector
 * 
 * Silently probes whether a site exposes a WebMCP manifest.
 * Emits events: 'detected', 'fallback', 'error'
 */
export class ProtocolDetector extends EventEmitter {
    private config: ScoutConfig;
    private cache: Map<string, CachedDetection> = new Map();

    constructor(config: Partial<ScoutConfig> = {}) {
        super();
        this.config = { ...DEFAULT_SCOUT_CONFIG, ...config };
    }

    /**
     * Detect WebMCP support for a given URL.
     * Tries multiple detection methods in order of efficiency.
     */
    async detect(url: string): Promise<ProtocolDetectionResult> {
        const start = Date.now();
        const origin = this.extractOrigin(url);

        // Check cache first
        const cached = this.getFromCache(origin);
        if (cached) {
            this.log(`Cache hit for ${origin}`);
            return cached;
        }

        try {
            // Method 1: HTTP Headers (fastest — single HEAD request)
            const headerResult = await this.detectViaHeaders(url, origin, start);
            if (headerResult.detected) {
                this.cacheResult(origin, headerResult);
                this.emit('detected', headerResult);
                return headerResult;
            }

            // Method 2: Well-known endpoint
            const wellKnownResult = await this.detectViaWellKnown(origin, start);
            if (wellKnownResult.detected) {
                this.cacheResult(origin, wellKnownResult);
                this.emit('detected', wellKnownResult);
                return wellKnownResult;
            }

            // Method 3: HTML meta tag (most expensive — requires full page fetch)
            const metaResult = await this.detectViaMeta(url, origin, start);
            if (metaResult.detected) {
                this.cacheResult(origin, metaResult);
                this.emit('detected', metaResult);
                return metaResult;
            }

            // No WebMCP detected — fall back to CUA
            const fallbackResult = this.buildResult(url, origin, false, 'none', undefined, undefined, start);
            this.cacheResult(origin, fallbackResult);
            this.emit('fallback', fallbackResult);
            return fallbackResult;

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const errorResult = this.buildResult(url, origin, false, 'none', undefined, undefined, start, errorMsg);
            this.emit('error', errorResult);
            return errorResult;
        }
    }

    // ============================================
    // DETECTION METHODS
    // ============================================

    /**
     * Detect via HTTP response headers (HEAD request).
     * Checks for X-MCP-Manifest header or Link rel="mcp-manifest".
     */
    private async detectViaHeaders(
        url: string,
        origin: string,
        start: number
    ): Promise<ProtocolDetectionResult> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.config.detectionTimeoutMs);

            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                redirect: 'follow',
            });
            clearTimeout(timeout);

            // Check direct MCP headers
            for (const headerName of MCP_HEADER_NAMES) {
                const manifestUrl = response.headers.get(headerName);
                if (manifestUrl) {
                    this.log(`Found ${headerName} header: ${manifestUrl}`);
                    const manifest = await this.fetchManifest(this.resolveUrl(origin, manifestUrl));
                    if (manifest) {
                        return this.buildResult(url, origin, true, 'http-header', manifest, manifestUrl, start);
                    }
                }
            }

            // Check Link header
            const linkHeader = response.headers.get('link');
            if (linkHeader) {
                const manifestUrl = this.parseLinkHeader(linkHeader);
                if (manifestUrl) {
                    this.log(`Found Link header with mcp-manifest: ${manifestUrl}`);
                    const manifest = await this.fetchManifest(this.resolveUrl(origin, manifestUrl));
                    if (manifest) {
                        return this.buildResult(url, origin, true, 'http-header', manifest, manifestUrl, start);
                    }
                }
            }

            return this.buildResult(url, origin, false, 'none', undefined, undefined, start);
        } catch {
            this.log(`Header detection failed for ${url}`);
            return this.buildResult(url, origin, false, 'none', undefined, undefined, start);
        }
    }

    /**
     * Detect via well-known endpoint (/.well-known/mcp.json).
     */
    private async detectViaWellKnown(
        origin: string,
        start: number
    ): Promise<ProtocolDetectionResult> {
        const wellKnownUrl = `${origin}${WELL_KNOWN_PATH}`;
        try {
            const manifest = await this.fetchManifest(wellKnownUrl);
            if (manifest) {
                this.log(`Found manifest at ${wellKnownUrl}`);
                return this.buildResult(wellKnownUrl, origin, true, 'well-known', manifest, wellKnownUrl, start);
            }
            return this.buildResult(wellKnownUrl, origin, false, 'none', undefined, undefined, start);
        } catch {
            return this.buildResult(wellKnownUrl, origin, false, 'none', undefined, undefined, start);
        }
    }

    /**
     * Detect via HTML meta tag in page head.
     */
    private async detectViaMeta(
        url: string,
        origin: string,
        start: number
    ): Promise<ProtocolDetectionResult> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.config.detectionTimeoutMs);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                redirect: 'follow',
                headers: { 'Accept': 'text/html' },
            });
            clearTimeout(timeout);

            const html = await response.text();

            // Extract only the <head> section to minimize parsing
            const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
            if (!headMatch) {
                return this.buildResult(url, origin, false, 'none', undefined, undefined, start);
            }

            const head = headMatch[1];
            const metaMatch = head.match(
                new RegExp(`<meta[^>]+name=["']${META_TAG_NAME}["'][^>]+content=["']([^"']+)["']`, 'i')
            );

            if (!metaMatch) {
                // Try alternate attribute order
                const altMatch = head.match(
                    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${META_TAG_NAME}["']`, 'i')
                );
                if (!altMatch) {
                    return this.buildResult(url, origin, false, 'none', undefined, undefined, start);
                }
                const manifestUrl = altMatch[1];
                const manifest = await this.fetchManifest(this.resolveUrl(origin, manifestUrl));
                if (manifest) {
                    return this.buildResult(url, origin, true, 'meta-tag', manifest, manifestUrl, start);
                }
                return this.buildResult(url, origin, false, 'none', undefined, undefined, start);
            }

            const manifestUrl = metaMatch[1];
            this.log(`Found meta tag mcp-manifest: ${manifestUrl}`);
            const manifest = await this.fetchManifest(this.resolveUrl(origin, manifestUrl));
            if (manifest) {
                return this.buildResult(url, origin, true, 'meta-tag', manifest, manifestUrl, start);
            }

            return this.buildResult(url, origin, false, 'none', undefined, undefined, start);
        } catch {
            return this.buildResult(url, origin, false, 'none', undefined, undefined, start);
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    /**
     * Fetch and parse a manifest JSON from a URL.
     */
    private async fetchManifest(url: string): Promise<WebMCPManifest | undefined> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.config.detectionTimeoutMs);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' },
            });
            clearTimeout(timeout);

            if (!response.ok) return undefined;

            const data = await response.json();

            // Basic shape validation
            if (
                typeof data === 'object' &&
                data !== null &&
                'version' in data &&
                'name' in data &&
                'tools' in data &&
                Array.isArray(data.tools)
            ) {
                return data as WebMCPManifest;
            }

            this.log(`Manifest at ${url} has invalid shape`);
            return undefined;
        } catch {
            this.log(`Failed to fetch manifest from ${url}`);
            return undefined;
        }
    }

    /**
     * Parse Link header to find MCP manifest URL.
     * Format: <url>; rel="mcp-manifest"
     */
    parseLinkHeader(header: string): string | undefined {
        const parts = header.split(',');
        for (const part of parts) {
            const match = part.match(/<([^>]+)>;\s*rel=["']?([^"'\s;]+)["']?/);
            if (match && match[2] === MCP_LINK_REL) {
                return match[1];
            }
        }
        return undefined;
    }

    /**
     * Extract origin from a URL.
     */
    extractOrigin(url: string): string {
        try {
            const parsed = new URL(url);
            return parsed.origin;
        } catch {
            return url;
        }
    }

    /**
     * Resolve a potentially relative manifest URL against an origin.
     */
    private resolveUrl(origin: string, manifestUrl: string): string {
        if (manifestUrl.startsWith('http://') || manifestUrl.startsWith('https://')) {
            return manifestUrl;
        }
        return `${origin}${manifestUrl.startsWith('/') ? '' : '/'}${manifestUrl}`;
    }

    /**
     * Build a ProtocolDetectionResult.
     */
    private buildResult(
        url: string,
        origin: string,
        detected: boolean,
        method: DetectionMethod,
        manifest: WebMCPManifest | undefined,
        manifestUrl: string | undefined,
        startTime: number,
        error?: string,
    ): ProtocolDetectionResult {
        return {
            url,
            origin,
            detected,
            method,
            manifest,
            manifestUrl,
            latencyMs: Date.now() - startTime,
            error,
            timestamp: new Date(),
        };
    }

    // ============================================
    // CACHE
    // ============================================

    /**
     * Get a cached detection result if still valid.
     */
    private getFromCache(origin: string): ProtocolDetectionResult | undefined {
        const cached = this.cache.get(origin);
        if (cached && cached.expiresAt > new Date()) {
            return cached.result;
        }
        if (cached) {
            this.cache.delete(origin);
        }
        return undefined;
    }

    /**
     * Cache a detection result.
     */
    private cacheResult(origin: string, result: ProtocolDetectionResult): void {
        this.cache.set(origin, {
            result,
            expiresAt: new Date(Date.now() + this.config.cacheTtlMs),
        });
    }

    /**
     * Clear the detection cache.
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache size.
     */
    getCacheSize(): number {
        return this.cache.size;
    }

    // ============================================
    // LOGGING
    // ============================================

    /**
     * Log if verbose mode is enabled.
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[Scout:Detector] ${message}`);
        }
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a ProtocolDetector instance.
 */
export function createProtocolDetector(config?: Partial<ScoutConfig>): ProtocolDetector {
    return new ProtocolDetector(config);
}
