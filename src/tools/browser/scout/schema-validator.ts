/**
 * Sara Scout - Schema Validator
 * 
 * Validates WebMCP tool schemas against security policy.
 * Prevents execution of malicious or insecure tool definitions.
 * Integrates with The Censor's security philosophy.
 */

import type {
    MCPTool,
    WebMCPManifest,
    SchemaValidationResult,
    SchemaIssue,
} from './scout-types.js';

// ============================================
// CONSTANTS
// ============================================

/** Dangerous patterns in endpoint URLs */
const DANGEROUS_URL_PATTERNS = [
    /^javascript:/i,
    /^data:/i,
    /^vbscript:/i,
    /^file:/i,
];

/** Dangerous patterns in tool parameter defaults or descriptions */
const DANGEROUS_CONTENT_PATTERNS = [
    /\beval\s*\(/i,
    /\bFunction\s*\(/i,
    /\bsetTimeout\s*\(\s*["']/i,
    /\bsetInterval\s*\(\s*["']/i,
    /\bdocument\.write\s*\(/i,
    /\binnerHTML\s*=/i,
    /\b__proto__\b/i,
    /\bconstructor\s*\[/i,
    /on\w+\s*=\s*["']/i, // onclick=, onerror=, etc.
];

/** Maximum allowed parameter count per tool */
const MAX_PARAMETERS = 50;

/** Maximum tool name length */
const MAX_NAME_LENGTH = 128;

/** Maximum description length */
const MAX_DESCRIPTION_LENGTH = 2000;

// ============================================
// SCHEMA VALIDATOR
// ============================================

/**
 * Schema Validator
 * 
 * Validates WebMCP tool schemas against Sara's security policy.
 * Catches XSS, injection, and other malicious patterns.
 */
export class SchemaValidator {

    /**
     * Validate a single MCP tool against security policy.
     */
    validate(tool: MCPTool): SchemaValidationResult {
        const issues: SchemaIssue[] = [];

        // Check tool name
        this.validateName(tool.name, issues);

        // Check tool endpoint
        this.validateEndpoint(tool.endpoint, issues);

        // Check tool description for injection
        this.validateDescription(tool.description, issues);

        // Check parameters
        this.validateParameters(tool.parameters, tool.name, issues);

        // Check for excessive parameter count
        if (tool.parameters && tool.parameters.length > MAX_PARAMETERS) {
            issues.push({
                severity: 'warning',
                field: `${tool.name}.parameters`,
                message: `Tool has ${tool.parameters.length} parameters (max recommended: ${MAX_PARAMETERS})`,
                recommendation: 'Consider breaking this tool into smaller sub-tools.',
            });
        }

        // Determine if tool should be blocked
        const criticalIssues = issues.filter(i => i.severity === 'critical');
        const blocked = criticalIssues.length > 0;

        return {
            valid: issues.length === 0,
            toolName: tool.name,
            issues,
            blocked,
            blockReason: blocked
                ? `Tool "${tool.name}" blocked: ${criticalIssues.map(i => i.message).join('; ')}`
                : undefined,
        };
    }

    /**
     * Validate all tools in a WebMCP manifest.
     */
    validateManifest(manifest: WebMCPManifest): SchemaValidationResult[] {
        const results: SchemaValidationResult[] = [];

        // Validate manifest-level fields
        if (manifest.baseUrl) {
            const baseUrlIssues: SchemaIssue[] = [];
            this.validateEndpoint(manifest.baseUrl, baseUrlIssues, 'manifest.baseUrl');
            if (baseUrlIssues.length > 0) {
                results.push({
                    valid: false,
                    toolName: '__manifest__',
                    issues: baseUrlIssues,
                    blocked: baseUrlIssues.some(i => i.severity === 'critical'),
                    blockReason: 'Manifest base URL failed validation',
                });
            }
        }

        // Validate each tool
        for (const tool of manifest.tools) {
            results.push(this.validate(tool));
        }

        return results;
    }

    /**
     * Check if a manifest is safe to use (no blocked tools).
     */
    isManifestSafe(results: SchemaValidationResult[]): boolean {
        return results.every(r => !r.blocked);
    }

    /**
     * Get only the safe tools from validation results.
     */
    getSafeTools(tools: MCPTool[], results: SchemaValidationResult[]): MCPTool[] {
        const blockedNames = new Set(
            results.filter(r => r.blocked).map(r => r.toolName)
        );
        return tools.filter(t => !blockedNames.has(t.name));
    }

    /**
     * Generate a security report from validation results.
     */
    generateReport(results: SchemaValidationResult[]): string {
        const blocked = results.filter(r => r.blocked);
        const warnings = results.filter(r => !r.blocked && r.issues.length > 0);
        const clean = results.filter(r => r.issues.length === 0);

        const lines = [
            '## Schema Validation Report',
            '',
            `**Total Tools:** ${results.length}`,
            `**Clean:** ${clean.length} | **Warnings:** ${warnings.length} | **Blocked:** ${blocked.length}`,
            '',
        ];

        if (blocked.length > 0) {
            lines.push('### 🚫 Blocked Tools:');
            for (const r of blocked) {
                lines.push(`- **${r.toolName}**: ${r.blockReason}`);
                for (const issue of r.issues) {
                    lines.push(`  - [${issue.severity}] ${issue.message}`);
                }
            }
            lines.push('');
        }

        if (warnings.length > 0) {
            lines.push('### ⚠️ Warnings:');
            for (const r of warnings) {
                for (const issue of r.issues) {
                    lines.push(`- **${r.toolName}** [${issue.severity}]: ${issue.message}`);
                }
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    // ============================================
    // VALIDATION HELPERS
    // ============================================

    /**
     * Validate tool name for safety.
     */
    private validateName(name: string, issues: SchemaIssue[]): void {
        if (!name || typeof name !== 'string') {
            issues.push({
                severity: 'critical',
                field: 'name',
                message: 'Tool name is missing or invalid',
                recommendation: 'Provide a valid string name for the tool.',
            });
            return;
        }

        if (name.length > MAX_NAME_LENGTH) {
            issues.push({
                severity: 'warning',
                field: 'name',
                message: `Tool name exceeds ${MAX_NAME_LENGTH} characters`,
                recommendation: 'Use a shorter, descriptive tool name.',
            });
        }

        // Check for path traversal in name
        if (name.includes('..') || name.includes('/') || name.includes('\\')) {
            issues.push({
                severity: 'critical',
                field: 'name',
                message: 'Tool name contains path traversal characters',
                recommendation: 'Use only alphanumeric characters, underscores, and hyphens in tool names.',
            });
        }
    }

    /**
     * Validate endpoint URL for safety.
     */
    private validateEndpoint(endpoint: string, issues: SchemaIssue[], field: string = 'endpoint'): void {
        if (!endpoint || typeof endpoint !== 'string') {
            issues.push({
                severity: 'critical',
                field,
                message: 'Endpoint is missing or invalid',
                recommendation: 'Provide a valid HTTPS endpoint URL.',
            });
            return;
        }

        // Check for dangerous URL schemes
        for (const pattern of DANGEROUS_URL_PATTERNS) {
            if (pattern.test(endpoint)) {
                issues.push({
                    severity: 'critical',
                    field,
                    message: `Endpoint uses dangerous scheme: ${endpoint.split(':')[0]}`,
                    recommendation: 'Only HTTPS endpoints are allowed.',
                });
                return;
            }
        }

        // Check for HTTPS (only for absolute URLs)
        if (endpoint.startsWith('http://')) {
            issues.push({
                severity: 'warning',
                field,
                message: 'Endpoint uses HTTP instead of HTTPS',
                recommendation: 'Use HTTPS for secure communication.',
            });
        }

        // Check for localhost/internal IPs in production
        if (this.isInternalUrl(endpoint)) {
            issues.push({
                severity: 'warning',
                field,
                message: 'Endpoint points to a local or internal address',
                recommendation: 'Ensure this is intentional and not an SSRF vector.',
            });
        }
    }

    /**
     * Validate description for injection content.
     */
    private validateDescription(description: string, issues: SchemaIssue[]): void {
        if (!description) return;

        if (description.length > MAX_DESCRIPTION_LENGTH) {
            issues.push({
                severity: 'info',
                field: 'description',
                message: `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters`,
                recommendation: 'Truncate description to reduce token usage.',
            });
        }

        for (const pattern of DANGEROUS_CONTENT_PATTERNS) {
            if (pattern.test(description)) {
                issues.push({
                    severity: 'critical',
                    field: 'description',
                    message: 'Description contains potentially dangerous code pattern',
                    recommendation: 'Remove executable code patterns from description.',
                });
                return;
            }
        }
    }

    /**
     * Validate tool parameters for safety.
     */
    private validateParameters(
        parameters: MCPTool['parameters'],
        toolName: string,
        issues: SchemaIssue[]
    ): void {
        if (!parameters || !Array.isArray(parameters)) return;

        for (const param of parameters) {
            const field = `${toolName}.parameters.${param.name}`;

            // Check parameter name
            if (!param.name || typeof param.name !== 'string') {
                issues.push({
                    severity: 'warning',
                    field,
                    message: 'Parameter has missing or invalid name',
                    recommendation: 'Provide valid parameter names.',
                });
                continue;
            }

            // Check default values for dangerous content
            if (param.default !== undefined && typeof param.default === 'string') {
                for (const pattern of DANGEROUS_CONTENT_PATTERNS) {
                    if (pattern.test(param.default)) {
                        issues.push({
                            severity: 'critical',
                            field,
                            message: `Parameter default value contains dangerous pattern`,
                            recommendation: 'Remove executable code from parameter defaults.',
                        });
                        break;
                    }
                }
            }

            // Check valid type
            const validTypes = ['string', 'number', 'boolean', 'object', 'array', 'integer'];
            if (param.type && !validTypes.includes(param.type.toLowerCase())) {
                issues.push({
                    severity: 'info',
                    field,
                    message: `Unknown parameter type: ${param.type}`,
                    recommendation: `Use standard JSON Schema types: ${validTypes.join(', ')}.`,
                });
            }
        }
    }

    /**
     * Check if a URL points to a local or internal address.
     */
    private isInternalUrl(url: string): boolean {
        const internalPatterns = [
            /localhost/i,
            /127\.0\.0\.\d+/,
            /10\.\d+\.\d+\.\d+/,
            /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
            /192\.168\.\d+\.\d+/,
            /\[::1\]/,
            /0\.0\.0\.0/,
        ];
        return internalPatterns.some(p => p.test(url));
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a SchemaValidator instance.
 */
export function createSchemaValidator(): SchemaValidator {
    return new SchemaValidator();
}
