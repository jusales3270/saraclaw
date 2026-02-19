/**
 * Sara Scout - Shared Types
 * 
 * Types for the hybrid access orchestrator (WebMCP + CUA).
 * Defines the protocol detection, tool mapping, routing, and budget tracking interfaces.
 */

// ============================================
// ACCESS PATH
// ============================================

/**
 * Available access paths for browser interaction
 */
export type AccessPath = 'webmcp' | 'cua';

// ============================================
// WEBMCP MANIFEST
// ============================================

/**
 * Parameter definition within an MCP tool
 */
export interface MCPToolParameter {
    /** Parameter name */
    name: string;

    /** JSON Schema type (string, number, boolean, object, array) */
    type: string;

    /** Human-readable description */
    description?: string;

    /** Whether the parameter is required */
    required?: boolean;

    /** Default value */
    default?: unknown;

    /** Enum values for restricted inputs */
    enum?: string[];
}

/**
 * A single tool declared in a WebMCP manifest
 */
export interface MCPTool {
    /** Tool name (e.g., "search_flights", "add_to_cart") */
    name: string;

    /** Human-readable description */
    description: string;

    /** Tool category */
    category: 'declarative' | 'imperative';

    /** HTTP method for the tool endpoint */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

    /** Endpoint path (relative to manifest base URL) */
    endpoint: string;

    /** Input parameters */
    parameters: MCPToolParameter[];

    /** Expected response content type */
    responseType?: string;

    /** Whether this tool requires user confirmation (e.g., payments) */
    requiresConfirmation?: boolean;

    /** Tags for intent matching */
    tags?: string[];
}

/**
 * WebMCP manifest exposed by a compatible site
 */
export interface WebMCPManifest {
    /** Manifest version (e.g., "1.0") */
    version: string;

    /** Site name */
    name: string;

    /** Site description */
    description?: string;

    /** Base URL for all tool endpoints */
    baseUrl: string;

    /** Authentication requirements */
    auth?: {
        type: 'none' | 'bearer' | 'api-key' | 'oauth2';
        headerName?: string;
        tokenUrl?: string;
    };

    /** Available tools */
    tools: MCPTool[];

    /** Manifest metadata */
    metadata?: {
        contact?: string;
        documentation?: string;
        termsOfService?: string;
    };
}

// ============================================
// PROTOCOL DETECTION
// ============================================

/**
 * Method used to detect the WebMCP manifest
 */
export type DetectionMethod = 'http-header' | 'well-known' | 'meta-tag' | 'none';

/**
 * Result of protocol detection on a site
 */
export interface ProtocolDetectionResult {
    /** The URL that was probed */
    url: string;

    /** Origin extracted from the URL */
    origin: string;

    /** Whether WebMCP was detected */
    detected: boolean;

    /** How the manifest was found */
    method: DetectionMethod;

    /** The parsed manifest (if detected) */
    manifest?: WebMCPManifest;

    /** Raw manifest URL that was resolved */
    manifestUrl?: string;

    /** Detection latency in milliseconds */
    latencyMs: number;

    /** Error message if detection failed */
    error?: string;

    /** Timestamp of detection */
    timestamp: Date;
}

/**
 * Cached detection result with TTL
 */
export interface CachedDetection {
    result: ProtocolDetectionResult;
    expiresAt: Date;
}

// ============================================
// ROUTING
// ============================================

/**
 * Full routing decision with rationale
 */
export interface RoutingDecision {
    /** Chosen access path */
    path: AccessPath;

    /** Target URL */
    url: string;

    /** User intent (if provided) */
    intent?: string;

    /** Matched tool (if WebMCP path) */
    matchedTool?: MCPTool;

    /** Detection result that informed the decision */
    detection: ProtocolDetectionResult;

    /** Human-readable rationale for the decision */
    rationale: string;

    /** Monologue text for Sara's inner thoughts */
    monologue: string;

    /** Estimated token cost for this access method */
    estimatedTokens: number;

    /** Estimated token cost if the other path had been chosen */
    alternativeTokens: number;

    /** Timestamp */
    timestamp: Date;
}

// ============================================
// BUDGET TRACKING
// ============================================

/**
 * Single budget entry for cost tracking
 */
export interface BudgetEntry {
    /** Unique request ID */
    id: string;

    /** URL accessed */
    url: string;

    /** Access path used */
    path: AccessPath;

    /** Estimated tokens consumed */
    tokensUsed: number;

    /** Estimated tokens that would have been used by the alternative path */
    tokensAlternative: number;

    /** Token savings (positive = savings, negative = extra cost) */
    tokensSaved: number;

    /** Timestamp */
    timestamp: Date;
}

/**
 * Aggregated budget statistics
 */
export interface BudgetStats {
    /** Total requests tracked */
    totalRequests: number;

    /** Requests via WebMCP */
    webmcpCount: number;

    /** Requests via CUA */
    cuaCount: number;

    /** Total estimated tokens saved by using WebMCP */
    estimatedTokensSaved: number;

    /** Average tokens per WebMCP request */
    avgTokensWebMCP: number;

    /** Average tokens per CUA request */
    avgTokensCUA: number;

    /** WebMCP hit rate (0-1) */
    webmcpHitRate: number;
}

// ============================================
// SCHEMA VALIDATION
// ============================================

/**
 * Security issue found during schema validation
 */
export interface SchemaIssue {
    /** Issue severity */
    severity: 'critical' | 'warning' | 'info';

    /** Which field/tool had the issue */
    field: string;

    /** Description of the issue */
    message: string;

    /** Recommended action */
    recommendation: string;
}

/**
 * Result of validating a tool schema against security policy
 */
export interface SchemaValidationResult {
    /** Whether the schema passed validation */
    valid: boolean;

    /** Tool name being validated */
    toolName: string;

    /** Issues found */
    issues: SchemaIssue[];

    /** Whether the tool was blocked */
    blocked: boolean;

    /** Block reason (if blocked) */
    blockReason?: string;
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Scout module configuration
 */
export interface ScoutConfig {
    /** Enable WebMCP detection (default: true) */
    enabled: boolean;

    /** Cache TTL for detection results in ms (default: 5 min) */
    cacheTtlMs: number;

    /** Timeout for detection probes in ms (default: 3000) */
    detectionTimeoutMs: number;

    /** Whether to validate schemas before use (default: true) */
    validateSchemas: boolean;

    /** Whether to track budget metrics (default: true) */
    trackBudget: boolean;

    /** Estimated average tokens for a CUA interaction */
    cuaTokenEstimate: number;

    /** Estimated average tokens for a WebMCP interaction */
    webmcpTokenEstimate: number;

    /** Verbose logging */
    verbose: boolean;
}

/**
 * Default Scout configuration
 */
export const DEFAULT_SCOUT_CONFIG: ScoutConfig = {
    enabled: true,
    cacheTtlMs: 5 * 60 * 1000, // 5 minutes
    detectionTimeoutMs: 3000,
    validateSchemas: true,
    trackBudget: true,
    cuaTokenEstimate: 2000,
    webmcpTokenEstimate: 200,
    verbose: false,
};
