/**
 * Sara Scout Module
 * 
 * Hybrid Access Orchestrator (WebMCP + CUA).
 * Detects structured tool support on websites and routes interactions optimally.
 */

export * from './scout-types.js';
export * from './protocol-detector.js';
export * from './tool-mapper.js';
export * from './schema-validator.js';
export * from './budget-tracker.js';
export * from './access-router.js';

// Convenience re-exports
export {
    ProtocolDetector,
    createProtocolDetector,
} from './protocol-detector.js';

export {
    ToolMapper,
    createToolMapper,
} from './tool-mapper.js';

export {
    SchemaValidator,
    createSchemaValidator,
} from './schema-validator.js';

export {
    BudgetTracker,
    createBudgetTracker,
} from './budget-tracker.js';

export {
    AccessRouter,
    createAccessRouter,
} from './access-router.js';

export type {
    AccessPath,
    WebMCPManifest,
    MCPTool,
    MCPToolParameter,
    ProtocolDetectionResult,
    CachedDetection,
    DetectionMethod,
    RoutingDecision,
    BudgetEntry,
    BudgetStats,
    SchemaValidationResult,
    SchemaIssue,
    ScoutConfig,
} from './scout-types.js';
