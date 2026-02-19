/**
 * Sara Scout - Schema Validator Tests
 */

import { describe, it, expect } from 'vitest';
import { SchemaValidator, createSchemaValidator } from './schema-validator.js';
import type { MCPTool, WebMCPManifest } from './scout-types.js';

// ============================================
// TEST DATA
// ============================================

const safeTool: MCPTool = {
    name: 'search_products',
    description: 'Search for products in the catalog',
    category: 'declarative',
    method: 'GET',
    endpoint: 'https://api.example.com/products/search',
    parameters: [
        { name: 'query', type: 'string', required: true },
        { name: 'limit', type: 'number', required: false, default: 10 },
    ],
};

const dangerousUrlTool: MCPTool = {
    name: 'xss_tool',
    description: 'A tool with dangerous endpoint',
    category: 'imperative',
    method: 'POST',
    endpoint: 'javascript:alert(1)',
    parameters: [],
};

const evalTool: MCPTool = {
    name: 'eval_tool',
    description: 'A tool that uses eval() in description to execute code',
    category: 'imperative',
    method: 'POST',
    endpoint: 'https://safe.example.com/api',
    parameters: [],
};

const pathTraversalTool: MCPTool = {
    name: '../../etc/passwd',
    description: 'A tool with path traversal in name',
    category: 'declarative',
    method: 'GET',
    endpoint: 'https://safe.example.com/api',
    parameters: [],
};

const dangerousDefaultTool: MCPTool = {
    name: 'dangerous_defaults',
    description: 'Tool with dangerous parameter defaults',
    category: 'declarative',
    method: 'GET',
    endpoint: 'https://safe.example.com/api',
    parameters: [
        { name: 'callback', type: 'string', default: 'eval("alert(1)")' },
    ],
};

const httpTool: MCPTool = {
    name: 'insecure_http',
    description: 'Uses HTTP instead of HTTPS',
    category: 'declarative',
    method: 'GET',
    endpoint: 'http://example.com/api',
    parameters: [],
};

const localTool: MCPTool = {
    name: 'local_tool',
    description: 'Points to localhost',
    category: 'declarative',
    method: 'GET',
    endpoint: 'https://localhost:3000/api',
    parameters: [],
};

// ============================================
// TESTS
// ============================================

describe('SchemaValidator', () => {
    const validator = createSchemaValidator();

    describe('validate', () => {
        it('should pass a safe tool', () => {
            const result = validator.validate(safeTool);
            expect(result.valid).toBe(true);
            expect(result.blocked).toBe(false);
            expect(result.issues).toHaveLength(0);
        });

        it('should block tool with javascript: endpoint', () => {
            const result = validator.validate(dangerousUrlTool);
            expect(result.blocked).toBe(true);
            expect(result.issues.some(i => i.severity === 'critical')).toBe(true);
            expect(result.blockReason).toContain('dangerous scheme');
        });

        it('should block tool with eval() in description', () => {
            const result = validator.validate(evalTool);
            expect(result.blocked).toBe(true);
            expect(result.issues.some(i => i.message.includes('dangerous code pattern'))).toBe(true);
        });

        it('should block tool with path traversal in name', () => {
            const result = validator.validate(pathTraversalTool);
            expect(result.blocked).toBe(true);
            expect(result.issues.some(i => i.message.includes('path traversal'))).toBe(true);
        });

        it('should block tool with dangerous parameter defaults', () => {
            const result = validator.validate(dangerousDefaultTool);
            expect(result.blocked).toBe(true);
            expect(result.issues.some(i => i.severity === 'critical')).toBe(true);
        });

        it('should warn about HTTP endpoints', () => {
            const result = validator.validate(httpTool);
            expect(result.valid).toBe(false);
            expect(result.blocked).toBe(false);
            expect(result.issues.some(i => i.severity === 'warning' && i.message.includes('HTTP'))).toBe(true);
        });

        it('should warn about localhost endpoints', () => {
            const result = validator.validate(localTool);
            expect(result.valid).toBe(false);
            expect(result.blocked).toBe(false);
            expect(result.issues.some(i => i.message.includes('local'))).toBe(true);
        });

        it('should handle tool with missing name', () => {
            const noName = { ...safeTool, name: '' };
            const result = validator.validate(noName);
            expect(result.blocked).toBe(true);
        });

        it('should handle tool with missing endpoint', () => {
            const noEndpoint = { ...safeTool, endpoint: '' };
            const result = validator.validate(noEndpoint);
            expect(result.blocked).toBe(true);
        });

        it('should warn about data: URI scheme', () => {
            const dataUri: MCPTool = { ...safeTool, endpoint: 'data:text/html,<h1>hi</h1>' };
            const result = validator.validate(dataUri);
            expect(result.blocked).toBe(true);
        });

        it('should warn about unknown parameter types', () => {
            const unknownType: MCPTool = {
                ...safeTool,
                parameters: [{ name: 'x', type: 'foobar' }],
            };
            const result = validator.validate(unknownType);
            expect(result.issues.some(i => i.message.includes('Unknown parameter type'))).toBe(true);
        });
    });

    describe('validateManifest', () => {
        it('should validate all tools in a manifest', () => {
            const manifest: WebMCPManifest = {
                version: '1.0',
                name: 'Test',
                baseUrl: 'https://safe.example.com',
                tools: [safeTool, dangerousUrlTool],
            };
            const results = validator.validateManifest(manifest);
            expect(results.length).toBeGreaterThanOrEqual(2);
            expect(results.some(r => r.blocked)).toBe(true);
            expect(results.some(r => !r.blocked)).toBe(true);
        });
    });

    describe('getSafeTools', () => {
        it('should filter out blocked tools', () => {
            const tools = [safeTool, dangerousUrlTool];
            const results = tools.map(t => validator.validate(t));
            const safe = validator.getSafeTools(tools, results);
            expect(safe).toHaveLength(1);
            expect(safe[0].name).toBe('search_products');
        });
    });

    describe('isManifestSafe', () => {
        it('should return false if any tool is blocked', () => {
            const results = [safeTool, dangerousUrlTool].map(t => validator.validate(t));
            expect(validator.isManifestSafe(results)).toBe(false);
        });

        it('should return true if all tools pass', () => {
            const results = [safeTool].map(t => validator.validate(t));
            expect(validator.isManifestSafe(results)).toBe(true);
        });
    });

    describe('generateReport', () => {
        it('should generate a report with blocked and clean sections', () => {
            const results = [safeTool, dangerousUrlTool].map(t => validator.validate(t));
            const report = validator.generateReport(results);
            expect(report).toContain('Schema Validation Report');
            expect(report).toContain('Blocked');
            expect(report).toContain('Clean');
        });
    });

    describe('factory', () => {
        it('should create validator instance', () => {
            expect(createSchemaValidator()).toBeInstanceOf(SchemaValidator);
        });
    });
});
