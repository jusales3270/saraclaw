/**
 * Sara Scout - Tool Mapper Tests
 */

import { describe, it, expect } from 'vitest';
import { ToolMapper, createToolMapper } from './tool-mapper.js';
import type { WebMCPManifest, MCPTool } from './scout-types.js';

// ============================================
// TEST DATA
// ============================================

const SAMPLE_MANIFEST: WebMCPManifest = {
    version: '1.0',
    name: 'Travel Site',
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
                { name: 'date', type: 'string', required: true },
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
                { name: 'passengerName', type: 'string', required: true },
            ],
            requiresConfirmation: true,
        },
        {
            name: 'cancel_booking',
            description: 'Cancel an existing booking',
            category: 'imperative',
            method: 'DELETE',
            endpoint: '/bookings/{id}',
            parameters: [
                { name: 'id', type: 'string', required: true },
            ],
            requiresConfirmation: true,
        },
    ],
};

const INVALID_MANIFEST: WebMCPManifest = {
    version: '1.0',
    name: 'Bad Manifest',
    baseUrl: 'https://bad.example.com',
    tools: [
        // Missing endpoint
        { name: 'no_endpoint', description: 'Missing endpoint', category: 'declarative', method: 'GET', endpoint: '', parameters: [] },
        // Missing name
        { name: '', description: 'Missing name', category: 'declarative', method: 'GET', endpoint: '/test', parameters: [] },
    ] as MCPTool[],
};

// ============================================
// TESTS
// ============================================

describe('ToolMapper', () => {
    const mapper = createToolMapper();

    describe('mapTools', () => {
        it('should map valid tools from manifest', () => {
            const tools = mapper.mapTools(SAMPLE_MANIFEST);
            expect(tools).toHaveLength(3);
            expect(tools[0].name).toBe('search_flights');
            expect(tools[1].name).toBe('buy_ticket');
        });

        it('should resolve relative endpoints against baseUrl', () => {
            const tools = mapper.mapTools(SAMPLE_MANIFEST);
            expect(tools[0].endpoint).toBe('https://travel.example.com/api/flights/search');
            expect(tools[1].endpoint).toBe('https://travel.example.com/api/tickets/purchase');
        });

        it('should filter out invalid tools', () => {
            const tools = mapper.mapTools(INVALID_MANIFEST);
            expect(tools).toHaveLength(0);
        });

        it('should auto-generate tags', () => {
            const tools = mapper.mapTools(SAMPLE_MANIFEST);
            expect(tools[0].tags).toBeDefined();
            expect(tools[0].tags!.length).toBeGreaterThan(0);
        });

        it('should handle empty tools array', () => {
            const empty: WebMCPManifest = { ...SAMPLE_MANIFEST, tools: [] };
            const tools = mapper.mapTools(empty);
            expect(tools).toHaveLength(0);
        });

        it('should handle manifest without tools field', () => {
            const noTools = { ...SAMPLE_MANIFEST, tools: undefined as unknown as MCPTool[] };
            const tools = mapper.mapTools(noTools);
            expect(tools).toHaveLength(0);
        });
    });

    describe('findTool', () => {
        const tools = mapper.mapTools(SAMPLE_MANIFEST);

        it('should find tool by exact intent match', () => {
            const found = mapper.findTool(tools, 'search flights');
            expect(found).toBeDefined();
            expect(found!.name).toBe('search_flights');
        });

        it('should find tool by partial keyword', () => {
            const found = mapper.findTool(tools, 'buy a ticket');
            expect(found).toBeDefined();
            expect(found!.name).toBe('buy_ticket');
        });

        it('should find tool by description keyword', () => {
            const found = mapper.findTool(tools, 'cancel booking');
            expect(found).toBeDefined();
            expect(found!.name).toBe('cancel_booking');
        });

        it('should return undefined for unrecognized intent', () => {
            const found = mapper.findTool(tools, 'cook dinner');
            expect(found).toBeUndefined();
        });

        it('should return undefined for empty intent', () => {
            const found = mapper.findTool(tools, '');
            expect(found).toBeUndefined();
        });

        it('should return undefined for empty tools list', () => {
            const found = mapper.findTool([], 'search flights');
            expect(found).toBeUndefined();
        });
    });

    describe('categorizeTool', () => {
        it('should categorize GET methods as declarative', () => {
            const tool: MCPTool = {
                name: 'unknown_tool', description: 'Does something', category: 'declarative',
                method: 'GET', endpoint: '/test', parameters: [],
            };
            expect(mapper.categorizeTool(tool)).toBe('declarative');
        });

        it('should categorize POST methods as imperative', () => {
            const tool: MCPTool = {
                name: 'unknown_tool', description: 'Does something', category: 'declarative',
                method: 'POST', endpoint: '/test', parameters: [],
            };
            expect(mapper.categorizeTool(tool)).toBe('imperative');
        });

        it('should detect imperative keywords in name', () => {
            const tool: MCPTool = {
                name: 'delete_account', description: 'Removes user account', category: 'declarative',
                method: 'PATCH', endpoint: '/test', parameters: [],
            };
            expect(mapper.categorizeTool(tool)).toBe('imperative');
        });

        it('should detect declarative keywords in description', () => {
            const tool: MCPTool = {
                name: 'my_tool', description: 'Search through the database', category: 'imperative',
                method: 'GET', endpoint: '/test', parameters: [],
            };
            expect(mapper.categorizeTool(tool)).toBe('declarative');
        });
    });

    describe('getConfirmationTools', () => {
        it('should return tools that require confirmation', () => {
            const tools = mapper.mapTools(SAMPLE_MANIFEST);
            const confirmTools = mapper.getConfirmationTools(tools);
            expect(confirmTools.length).toBeGreaterThanOrEqual(2);
            expect(confirmTools.some(t => t.name === 'buy_ticket')).toBe(true);
        });
    });

    describe('summarize', () => {
        it('should generate human-readable summary', () => {
            const tools = mapper.mapTools(SAMPLE_MANIFEST);
            const summary = mapper.summarize(tools);
            expect(summary).toContain('Mapped Tools');
            expect(summary).toContain('search_flights');
            expect(summary).toContain('buy_ticket');
        });

        it('should handle empty tools', () => {
            const summary = mapper.summarize([]);
            expect(summary).toBe('No tools available.');
        });
    });

    describe('factory', () => {
        it('should create a ToolMapper instance', () => {
            const m = createToolMapper();
            expect(m).toBeInstanceOf(ToolMapper);
        });
    });
});
