/**
 * Sara Scout - Access Router Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccessRouter, createAccessRouter } from './access-router.js';
import type { WebMCPManifest } from './scout-types.js';

// ============================================
// TEST MANIFEST
// ============================================

const SAMPLE_MANIFEST: WebMCPManifest = {
    version: '1.0',
    name: 'Travel Service',
    description: 'Book flights and hotels',
    baseUrl: 'https://travel.example.com/api',
    tools: [
        {
            name: 'search_flights',
            description: 'Search for available flights',
            category: 'declarative',
            method: 'GET',
            endpoint: '/flights/search',
            parameters: [
                { name: 'origin', type: 'string', required: true },
                { name: 'destination', type: 'string', required: true },
            ],
        },
        {
            name: 'buy_ticket',
            description: 'Purchase a flight ticket',
            category: 'imperative',
            method: 'POST',
            endpoint: '/tickets/purchase',
            parameters: [
                { name: 'flightId', type: 'string', required: true },
            ],
            requiresConfirmation: true,
        },
    ],
};

// ============================================
// TESTS
// ============================================

describe('AccessRouter', () => {
    let router: AccessRouter;

    beforeEach(() => {
        router = createAccessRouter({
            enabled: true,
            detectionTimeoutMs: 1000,
            trackBudget: true,
        });
        vi.restoreAllMocks();
    });

    afterEach(() => {
        router.removeAllListeners();
    });

    describe('route', () => {
        it('should route to CUA when no WebMCP is detected', async () => {
            // Mock fetch to return no MCP signals
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('<html><head></head><body></body></html>', {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                })
            ));

            const decision = await router.route('https://legacy.example.com');
            expect(decision.path).toBe('cua');
            expect(decision.matchedTool).toBeUndefined();
            expect(decision.monologue).toContain('CUA Mode');
        });

        it('should route to WebMCP when manifest is detected via header', async () => {
            const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
                if (opts?.method === 'HEAD') {
                    return Promise.resolve(new Response('', {
                        status: 200,
                        headers: { 'x-mcp-manifest': '/mcp.json' },
                    }));
                }
                if (url.toString().includes('mcp.json')) {
                    return Promise.resolve(new Response(JSON.stringify(SAMPLE_MANIFEST), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    }));
                }
                return Promise.resolve(new Response('', { status: 404 }));
            });
            vi.stubGlobal('fetch', fetchMock);

            const decision = await router.route('https://travel.example.com', 'search flights');
            expect(decision.path).toBe('webmcp');
            expect(decision.matchedTool).toBeDefined();
            expect(decision.matchedTool!.name).toBe('search_flights');
            expect(decision.monologue).toContain('WebMCP Detected');
        });

        it('should include token estimates in decision', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('<html><head></head><body></body></html>', {
                    status: 200,
                    headers: {},
                })
            ));

            const decision = await router.route('https://legacy.example.com');
            expect(decision.estimatedTokens).toBeGreaterThan(0);
            expect(decision.alternativeTokens).toBeGreaterThan(0);
        });

        it('should fall back to CUA when Scout is disabled', async () => {
            const disabledRouter = createAccessRouter({ enabled: false });
            const decision = await disabledRouter.route('https://any.example.com');
            expect(decision.path).toBe('cua');
            expect(decision.rationale).toContain('disabled');
        });

        it('should emit route:cua event for CUA fallback', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('<html><head></head><body></body></html>', { status: 200, headers: {} })
            ));

            const cuaHandler = vi.fn();
            router.on('route:cua', cuaHandler);

            await router.route('https://legacy.example.com');
            expect(cuaHandler).toHaveBeenCalledTimes(1);
        });

        it('should emit route:webmcp event when WebMCP is used', async () => {
            const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
                if (opts?.method === 'HEAD') {
                    return Promise.resolve(new Response('', {
                        status: 200,
                        headers: { 'x-mcp-manifest': '/mcp.json' },
                    }));
                }
                if (url.toString().includes('mcp.json')) {
                    return Promise.resolve(new Response(JSON.stringify(SAMPLE_MANIFEST), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    }));
                }
                return Promise.resolve(new Response('', { status: 404 }));
            });
            vi.stubGlobal('fetch', fetchMock);

            const webmcpHandler = vi.fn();
            router.on('route:webmcp', webmcpHandler);

            await router.route('https://travel.example.com');
            expect(webmcpHandler).toHaveBeenCalledTimes(1);
        });

        it('should handle fetch errors gracefully', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

            const decision = await router.route('https://unreachable.example.com');
            expect(decision.path).toBe('cua');
        });
    });

    describe('getMonologueEntry', () => {
        it('should return formatted monologue text', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('<html><head></head><body></body></html>', { status: 200, headers: {} })
            ));

            const decision = await router.route('https://test.example.com');
            const monologue = router.getMonologueEntry(decision);
            expect(monologue).toContain('Scout Analysis');
            expect(monologue).toContain('test.example.com');
        });
    });

    describe('budget tracking', () => {
        it('should track budget on each routing decision', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('<html><head></head><body></body></html>', { status: 200, headers: {} })
            ));

            await router.route('https://site1.example.com');
            await router.route('https://site2.example.com');

            const stats = router.getBudgetStats();
            expect(stats.totalRequests).toBe(2);
            expect(stats.cuaCount).toBe(2);
        });

        it('should generate budget summary', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('<html><head></head><body></body></html>', { status: 200, headers: {} })
            ));

            await router.route('https://test.example.com');

            const summary = router.getBudgetSummary();
            expect(summary).toContain('Budget Tracker');
            expect(summary).toContain('Total Requests');
        });
    });

    describe('history', () => {
        it('should store routing history', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('<html><head></head><body></body></html>', { status: 200, headers: {} })
            ));

            await router.route('https://a.example.com');
            await router.route('https://b.example.com');

            const history = router.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0].url).toContain('a.example.com');
            expect(history[1].url).toContain('b.example.com');
        });
    });

    describe('accessors', () => {
        it('should expose detector, mapper, and validator', () => {
            expect(router.getDetector()).toBeDefined();
            expect(router.getMapper()).toBeDefined();
            expect(router.getValidator()).toBeDefined();
        });

        it('should generate module summary', async () => {
            const summary = router.getSummary();
            expect(summary).toContain('Scout Module Summary');
        });
    });

    describe('factory', () => {
        it('should create router with default config', () => {
            const r = createAccessRouter();
            expect(r).toBeInstanceOf(AccessRouter);
        });
    });
});
