/**
 * Sara Shield Module - The Budgeter
 * 
 * Resource management for financial and computational sustainability.
 * Controls API costs and provides emergency shutdown capabilities.
 * 
 * Components:
 * - TokenTracker: Real-time cost monitoring per API call
 * - Budgeter: Daily budget limits with HALT signal
 * - Emergency Kill-Switch: Immediate shutdown command
 * 
 * Usage:
 * - Set SARA_DAILY_BUDGET_USD in .env (default: $2.00/day)
 * - Send /sara-sleep-now to trigger emergency stop
 */

import { SecurityAuditLog, createSecurityAuditLog, SecurityEventType } from './security-audit-log.js';

// Reference Node.js global types
declare const process: { env: Record<string, string | undefined> };

// ============================================
// TOKEN PRICING (USD per 1K tokens)
// ============================================

/**
 * Token pricing per model
 * Updated based on current provider pricing (Feb 2026)
 */
export const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
    // Anthropic
    'anthropic/claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'anthropic/claude-3-opus': { input: 0.015, output: 0.075 },
    'anthropic/claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },

    // OpenAI
    'openai/gpt-4': { input: 0.03, output: 0.06 },
    'openai/gpt-4-turbo': { input: 0.01, output: 0.03 },
    'openai/gpt-4o': { input: 0.005, output: 0.015 },
    'openai/gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },

    // Google
    'google/gemini-pro': { input: 0.0005, output: 0.0015 },
    'google/gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'google/gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    'gemini-pro': { input: 0.0005, output: 0.0015 },
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },

    // Default fallback
    'default': { input: 0.01, output: 0.03 },
};

// ============================================
// TYPES
// ============================================

/** Token usage record */
export interface TokenUsage {
    /** Number of input tokens */
    inputTokens: number;

    /** Number of output tokens */
    outputTokens: number;

    /** Model identifier */
    model: string;

    /** Timestamp of usage */
    timestamp: Date;

    /** Calculated cost in USD */
    costUsd: number;
}

/** Daily budget status */
export interface BudgetStatus {
    /** Current daily cost in USD */
    dailyCost: number;

    /** Daily budget limit in USD */
    dailyLimit: number;

    /** Percentage of budget used */
    usagePercent: number;

    /** Whether budget is exhausted */
    isExhausted: boolean;

    /** Time until budget reset (ms) */
    msUntilReset: number;

    /** Number of API calls today */
    callCount: number;

    /** Last reset timestamp */
    lastReset: Date;
}

/** Budgeter configuration */
export interface BudgetConfig {
    /** Daily budget limit in USD */
    dailyLimitUsd: number;

    /** Emergency kill-switch command pattern */
    killSwitchCommand: string;

    /** Warning threshold (0-1, triggers warning at this % of budget) */
    warningThreshold: number;

    /** Enable budget enforcement */
    enabled: boolean;

    /** Verbose logging */
    verbose: boolean;

    /** Callback when budget is exhausted */
    onBudgetExhausted?: (status: BudgetStatus) => void;

    /** Callback when warning threshold reached */
    onWarningThreshold?: (status: BudgetStatus) => void;

    /** Enable security audit logging */
    enableAuditLog: boolean;
}

/** HALT signal for scheduler */
export interface HaltSignal {
    /** Type of halt */
    type: 'BUDGET_EXHAUSTED' | 'EMERGENCY_KILL' | 'MANUAL';

    /** Reason for halt */
    reason: string;

    /** Timestamp */
    timestamp: Date;

    /** Can resume after reset? */
    canAutoResume: boolean;

    /** Scheduled resume time (if applicable) */
    resumeAt?: Date;
}

// ============================================
// DEFAULTS
// ============================================

/** Default budget configuration */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
    dailyLimitUsd: 2.00,
    killSwitchCommand: '/sara-sleep-now',
    warningThreshold: 0.8, // Warn at 80% usage
    enabled: true,
    verbose: true,
    enableAuditLog: true,
};

// ============================================
// TOKEN TRACKER
// ============================================

/**
 * TokenTracker - Real-time API cost monitoring
 * 
 * Tracks token usage across all model providers and calculates
 * accumulated daily costs.
 */
export class TokenTracker {
    private usageHistory: TokenUsage[] = [];
    private dailyCost: number = 0;
    private lastReset: Date;
    private callCount: number = 0;

    constructor() {
        this.lastReset = this.getStartOfDay();
    }

    /**
     * Track token usage for an API call
     */
    trackUsage(inputTokens: number, outputTokens: number, model: string): TokenUsage {
        // Auto-reset at midnight
        this.checkDailyReset();

        const costUsd = this.calculateCost(inputTokens, outputTokens, model);

        const usage: TokenUsage = {
            inputTokens,
            outputTokens,
            model,
            timestamp: new Date(),
            costUsd,
        };

        this.usageHistory.push(usage);
        this.dailyCost += costUsd;
        this.callCount++;

        return usage;
    }

    /**
     * Calculate cost for a token usage
     */
    calculateCost(inputTokens: number, outputTokens: number, model: string): number {
        const pricing = TOKEN_PRICING[model] || TOKEN_PRICING['default'];

        const inputCost = (inputTokens / 1000) * pricing.input;
        const outputCost = (outputTokens / 1000) * pricing.output;

        return inputCost + outputCost;
    }

    /**
     * Get current daily cost
     */
    getDailyCost(): number {
        this.checkDailyReset();
        return this.dailyCost;
    }

    /**
     * Get number of API calls today
     */
    getCallCount(): number {
        this.checkDailyReset();
        return this.callCount;
    }

    /**
     * Get usage history for today
     */
    getUsageHistory(): TokenUsage[] {
        this.checkDailyReset();
        return [...this.usageHistory];
    }

    /**
     * Get time until next reset (midnight)
     */
    getMsUntilReset(): number {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime() - now.getTime();
    }

    /**
     * Get last reset timestamp
     */
    getLastReset(): Date {
        return new Date(this.lastReset);
    }

    /**
     * Force reset (for testing)
     */
    forceReset(): void {
        this.usageHistory = [];
        this.dailyCost = 0;
        this.callCount = 0;
        this.lastReset = this.getStartOfDay();
    }

    /**
     * Check if daily reset is needed
     */
    private checkDailyReset(): void {
        const startOfToday = this.getStartOfDay();

        if (startOfToday.getTime() > this.lastReset.getTime()) {
            // New day - reset counters
            this.usageHistory = [];
            this.dailyCost = 0;
            this.callCount = 0;
            this.lastReset = startOfToday;
        }
    }

    /**
     * Get start of current day
     */
    private getStartOfDay(): Date {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
    }
}

// ============================================
// BUDGETER
// ============================================

/**
 * Budgeter - Budget limits and emergency controls
 * 
 * Enforces daily spending limits and provides emergency shutdown
 * capabilities for Sara's autonomous operations.
 */
export class Budgeter {
    private config: BudgetConfig;
    private tokenTracker: TokenTracker;
    private securityLog: SecurityAuditLog | null = null;
    private haltSignal: HaltSignal | null = null;
    private warningEmitted: boolean = false;

    constructor(config: Partial<BudgetConfig> = {}) {
        this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
        this.tokenTracker = new TokenTracker();

        if (this.config.enableAuditLog) {
            this.securityLog = createSecurityAuditLog();
        }
    }

    /**
     * Track API usage and check budget
     * Returns true if within budget, false if exhausted
     */
    trackAndCheck(inputTokens: number, outputTokens: number, model: string): boolean {
        if (!this.config.enabled) {
            return true;
        }

        // Track the usage
        const usage = this.tokenTracker.trackUsage(inputTokens, outputTokens, model);

        // Log usage
        this.log(`💰 API Call: ${model} | ${inputTokens}in/${outputTokens}out | $${usage.costUsd.toFixed(4)}`);

        // Check budget status
        const status = this.getStatus();

        // Check warning threshold
        if (!this.warningEmitted && status.usagePercent >= this.config.warningThreshold * 100) {
            this.warningEmitted = true;
            this.log(`⚠️  BUDGET WARNING: ${status.usagePercent.toFixed(1)}% usado ($${status.dailyCost.toFixed(4)}/$${status.dailyLimit})`);

            if (this.config.onWarningThreshold) {
                this.config.onWarningThreshold(status);
            }
        }

        // Check exhaustion
        if (status.isExhausted) {
            this.emitHalt('BUDGET_EXHAUSTED', 'Limite diário de gastos atingido');

            if (this.config.onBudgetExhausted) {
                this.config.onBudgetExhausted(status);
            }

            return false;
        }

        return true;
    }

    /**
     * Check if message is kill-switch command
     */
    isKillSwitchCommand(message: string): boolean {
        const trimmed = message.trim().toLowerCase();
        const command = this.config.killSwitchCommand.toLowerCase();
        return trimmed === command || trimmed.startsWith(command + ' ');
    }

    /**
     * Handle kill-switch command
     */
    handleKillSwitch(source: string = 'unknown'): HaltSignal {
        this.log(`🚨 EMERGENCY KILL-SWITCH ativado por: ${source}`);

        // Log to security audit
        if (this.securityLog) {
            this.securityLog.log(
                'suspicious_activity' as SecurityEventType,
                'critical',
                `Emergency kill-switch activated by: ${source}`,
                {
                    source,
                    budgetStatus: this.getStatus(),
                }
            );
        }

        return this.emitHalt('EMERGENCY_KILL', `Kill-switch ativado por ${source}`);
    }

    /**
     * Emit HALT signal
     */
    emitHalt(type: HaltSignal['type'], reason: string): HaltSignal {
        const canAutoResume = type === 'BUDGET_EXHAUSTED';

        const signal: HaltSignal = {
            type,
            reason,
            timestamp: new Date(),
            canAutoResume,
        };

        if (canAutoResume) {
            // Calculate next midnight for auto-resume
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            signal.resumeAt = tomorrow;
        }

        this.haltSignal = signal;

        // Log to security audit
        if (this.securityLog) {
            this.securityLog.log(
                'suspicious_activity' as SecurityEventType,
                type === 'EMERGENCY_KILL' ? 'critical' : 'high',
                `HALT signal emitted: ${type} - ${reason}`,
                {
                    haltType: type,
                    reason,
                    canAutoResume,
                    resumeAt: signal.resumeAt?.toISOString(),
                }
            );
        }

        this.log(`🛑 HALT SIGNAL: ${type} - ${reason}`);

        return signal;
    }

    /**
     * Get current budget status
     */
    getStatus(): BudgetStatus {
        const dailyCost = this.tokenTracker.getDailyCost();
        const dailyLimit = this.config.dailyLimitUsd;
        const usagePercent = (dailyCost / dailyLimit) * 100;

        return {
            dailyCost,
            dailyLimit,
            usagePercent,
            isExhausted: dailyCost >= dailyLimit,
            msUntilReset: this.tokenTracker.getMsUntilReset(),
            callCount: this.tokenTracker.getCallCount(),
            lastReset: this.tokenTracker.getLastReset(),
        };
    }

    /**
     * Check if budget is exhausted
     */
    isBudgetExhausted(): boolean {
        if (!this.config.enabled) {
            return false;
        }
        return this.getStatus().isExhausted;
    }

    /**
     * Get current halt signal (if any)
     */
    getHaltSignal(): HaltSignal | null {
        return this.haltSignal;
    }

    /**
     * Clear halt signal (for resume)
     */
    clearHaltSignal(): void {
        this.haltSignal = null;
        this.warningEmitted = false;
    }

    /**
     * Check if can auto-resume
     */
    canAutoResume(): boolean {
        if (!this.haltSignal) {
            return false;
        }

        if (!this.haltSignal.canAutoResume) {
            return false;
        }

        if (this.haltSignal.resumeAt && new Date() >= this.haltSignal.resumeAt) {
            return true;
        }

        return false;
    }

    /**
     * Generate sleep message for channels
     */
    generateSleepMessage(): string {
        const status = this.getStatus();
        const hoursUntilReset = Math.ceil(status.msUntilReset / (1000 * 60 * 60));

        if (this.haltSignal?.type === 'EMERGENCY_KILL') {
            return '🚨 Recebi o comando de emergência. Entrando em modo de sono profundo. Até breve!';
        }

        return `💤 Vou dormir para economizar. Gastei $${status.dailyCost.toFixed(2)} de $${status.dailyLimit.toFixed(2)} hoje. Volto em ~${hoursUntilReset}h. Boa noite! 🌙`;
    }

    /**
     * Get token tracker instance
     */
    getTokenTracker(): TokenTracker {
        return this.tokenTracker;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<BudgetConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Log message
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[BUDGETER] ${message}`);
        }
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create Budgeter with environment configuration
 */
export function createBudgeter(config?: Partial<BudgetConfig>): Budgeter {
    const envConfig: Partial<BudgetConfig> = {
        dailyLimitUsd: parseFloat(process.env.SARA_DAILY_BUDGET_USD || '2.00'),
        killSwitchCommand: process.env.SARA_EMERGENCY_KILL_COMMAND || '/sara-sleep-now',
        enabled: process.env.SARA_DISABLE_BUDGETER !== 'true',
        verbose: process.env.LOG_LEVEL === 'debug',
    };

    return new Budgeter({ ...envConfig, ...config });
}

/**
 * Create TokenTracker instance
 */
export function createTokenTracker(): TokenTracker {
    return new TokenTracker();
}

// ============================================
// SINGLETON (for global access)
// ============================================

let globalBudgeter: Budgeter | null = null;

/**
 * Get or create global Budgeter instance
 */
export function getBudgeter(): Budgeter {
    if (!globalBudgeter) {
        globalBudgeter = createBudgeter();
    }
    return globalBudgeter;
}

/**
 * Reset global Budgeter (for testing)
 */
export function resetGlobalBudgeter(): void {
    globalBudgeter = null;
}
