/**
 * Sara Scout - Protocol Detector Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProtocolDetector, createProtocolDetector } from './protocol-detector.js';
import type { WebMCPManifest } from './scout-types.js';

// ============================================
// TEST MANIFEST
// ============================================

const SAMPLE_MANIFEST: WebMCPManifest = {
    version: '1.0',
    name: 'Test Site',
    description: 'A test site with WebMCP',
    baseUrl: 'https://example.com/api',
    tools: [
        {
            name: 'search_items',
            description: 'Search for items',
            category: 'declarative',
            method: 'GET',
            endpoint: '/search',
            parameters: [
                { name: 'query', type: 'string', required: true },
            ],
        },
    ],
};

// ============================================
// TESTS
// ============================================

describe('ProtocolDetector', () => {
    let detector: ProtocolDetector;

    beforeEach(() => {
        detector = createProtocolDetector({ detectionTimeoutMs: 1000 });
        vi.restoreAllMocks();
    });

    afterEach(() => {
        detector.clearCache();
    });

    describe('extractOrigin', () => {
        it('should extract origin from URL', () => {
            expect(detector.extractOrigin('https://example.com/path')).toBe('https://example.com');
            expect(detector.extractOrigin('https://example.com:8080/path')).toBe('https://example.com:8080');
        });

        it('should return URL if parsing fails', () => {
            expect(detector.extractOrigin('not-a-url')).toBe('not-a-url');
        });
    });

    describe('parseLinkHeader', () => {
        it('should parse Link header with mcp-manifest rel', () => {
            const header = '</api/mcp.json>; rel="mcp-manifest"';
            expect(detector.parseLinkHeader(header)).toBe('/api/mcp.json');
        });

        it('should handle multiple Link values', () => {
            const header = '</style.css>; rel="stylesheet", </mcp.json>; rel="mcp-manifest"';
            expect(detector.parseLinkHeader(header)).toBe('/mcp.json');
        });

        it('should return undefined for non-matching Link header', () => {
            const header = '</style.css>; rel="stylesheet"';
            expect(detector.parseLinkHeader(header)).toBeUndefined();
        });

        it('should handle single-quoted rel values', () => {
            const header = "</mcp.json>; rel='mcp-manifest'";
            expect(detector.parseLinkHeader(header)).toBe('/mcp.json');
        });
    });

    describe('detect', () => {
        it('should return fallback when fetch fails (network error)', async () => {
            // Mock fetch to simulate network error
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

            const result = await detector.detect('https://no-site.example.com');
            expect(result.detected).toBe(false);
            expect(result.method).toBe('none');
            expect(result.origin).toBe('https://no-site.example.com');
        });

        it('should emit "fallback" event when no protocol detected', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('', { status: 200, headers: {} })
            ));

            const fallbackHandler = vi.fn();
            detector.on('fallback', fallbackHandler);

            const result = await detector.detect('https://legacy.example.com');
            expect(result.detected).toBe(false);
            // The fallback event should fire
            expect(fallbackHandler).toHaveBeenCalledTimes(1);
        });

        it('should cache detection results per origin', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                new Response('', { status: 200, headers: {} })
            );
            vi.stubGlobal('fetch', fetchMock);

            await detector.detect('https://cached.example.com/page1');
            const result2 = await detector.detect('https://cached.example.com/page2');

            // Second call should hit cache (same origin)
            expect(result2.detected).toBe(false);
            // fetch was called for the first detection (HEAD + well-known + GET for meta)
            // but NOT called again for the second detection
            const callsAfterFirst = fetchMock.mock.calls.length;
            await detector.detect('https://cached.example.com/page3');
            expect(fetchMock.mock.calls.length).toBe(callsAfterFirst); // no new calls
        });

        it('should detect via X-MCP-Manifest header', async () => {
            const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
                if (opts?.method === 'HEAD') {
                    return Promise.resolve(new Response('', {
                        status: 200,
                        headers: { 'x-mcp-manifest': '/api/mcp.json' },
                    }));
                }
                // Manifest fetch
                if (url.toString().includes('mcp.json')) {
                    return Promise.resolve(new Response(JSON.stringify(SAMPLE_MANIFEST), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    }));
                }
                return Promise.resolve(new Response('', { status: 404 }));
            });
            vi.stubGlobal('fetch', fetchMock);

            const result = await detector.detect('https://modern.example.com');
            expect(result.detected).toBe(true);
            expect(result.method).toBe('http-header');
            expect(result.manifest?.name).toBe('Test Site');
        });

        it('should detect via well-known endpoint', async () => {
            const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
                if (opts?.method === 'HEAD') {
                    return Promise.resolve(new Response('', { status: 200, headers: {} }));
                }
                if (url.toString().includes('/.well-known/mcp.json')) {
                    return Promise.resolve(new Response(JSON.stringify(SAMPLE_MANIFEST), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    }));
                }
                return Promise.resolve(new Response('<html><head></head></html>', {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                }));
            });
            vi.stubGlobal('fetch', fetchMock);

            const result = await detector.detect('https://wellknown.example.com');
            expect(result.detected).toBe(true);
            expect(result.method).toBe('well-known');
        });

        it('should clear cache', () => {
            detector.clearCache();
            expect(detector.getCacheSize()).toBe(0);
        });
    });

    describe('factory', () => {
        it('should create detector with custom config', () => {
            const custom = createProtocolDetector({ detectionTimeoutMs: 5000, verbose: true });
            expect(custom).toBeInstanceOf(ProtocolDetector);
        });
    });
});
