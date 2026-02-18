/**
 * Sara Shield Module
 * 
 * Security guardrails - The Censor, Budgeter, and runtime protection.
 */

export * from './the-censor.js';
export * from './patterns.js';
export * from './sandbox-enforcer.js';
export * from './security-audit-log.js';
export * from './budgeter.js';

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

export {
    SecurityAuditLog,
    createSecurityAuditLog,
    getSecurityLog,
    DEFAULT_AUDIT_CONFIG,
} from './security-audit-log.js';

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

export type {
    SecurityEventType,
    SecurityAuditEntry,
    SecurityAuditConfig,
} from './security-audit-log.js';

export {
    Budgeter,
    TokenTracker,
    createBudgeter,
    createTokenTracker,
    getBudgeter,
    resetGlobalBudgeter,
    TOKEN_PRICING,
    DEFAULT_BUDGET_CONFIG,
} from './budgeter.js';

export type {
    BudgetConfig,
    BudgetStatus,
    TokenUsage,
    HaltSignal,
} from './budgeter.js';

