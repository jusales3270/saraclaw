/**
 * Sara Shield Module
 * 
 * Security guardrails - The Censor and runtime protection.
 */

export * from './the-censor.js';
export * from './patterns.js';
export * from './sandbox-enforcer.js';

// Convenience re-exports
export {
    TheCensor,
    createCensor,
    censorMiddleware,
    DEFAULT_CENSOR_CONFIG,
} from './the-censor.js';

export {
    SENSITIVE_PATTERNS,
    getPatternsByType,
    getPatternsBySeverity,
    createPattern,
    validatePattern,
} from './patterns.js';

export {
    SandboxEnforcer,
    createSandboxEnforcer,
    BROWSER_SANDBOX_CONFIG,
    PYTHON_SANDBOX_CONFIG,
    SHELL_SANDBOX_CONFIG,
    DEFAULT_SANDBOX_CONFIG,
} from './sandbox-enforcer.js';

export type {
    CensorResult,
    CensorConfig,
} from './the-censor.js';

export type {
    PatternType,
    Severity,
    PatternDefinition,
    PatternMatch,
} from './patterns.js';

export type {
    SandboxConfig,
    SandboxResult,
} from './sandbox-enforcer.js';
