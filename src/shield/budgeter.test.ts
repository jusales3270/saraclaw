/**
 * Sara Shield Module - Budgeter Tests
 * 
 * Unit tests for TokenTracker and Budgeter components.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    TokenTracker,
    Budgeter,
    TOKEN_PRICING,
    DEFAULT_BUDGET_CONFIG,
    createBudgeter,
} from './budgeter.js';

// ============================================
// TOKEN TRACKER TESTS
// ============================================

describe('TokenTracker', () => {
    let tracker: TokenTracker;

    beforeEach(() => {
        tracker = new TokenTracker();
    });

    describe('calculateCost', () => {
        it('should calculate cost correctly for known models', () => {
            // Claude 3.5 Sonnet: $0.003/1K input, $0.015/1K output
            const cost = tracker.calculateCost(1000, 1000, 'claude-3.5-sonnet');

            // Expected: (1000/1000 * 0.003) + (1000/1000 * 0.015) = 0.018
            expect(cost).toBeCloseTo(0.018, 4);
        });

        it('should use default pricing for unknown models', () => {
            const cost = tracker.calculateCost(1000, 1000, 'unknown-model');
            const defaultPricing = TOKEN_PRICING['default'];

            const expected = (1000 / 1000 * defaultPricing.input) + (1000 / 1000 * defaultPricing.output);
            expect(cost).toBeCloseTo(expected, 4);
        });

        it('should handle zero tokens', () => {
            const cost = tracker.calculateCost(0, 0, 'claude-3.5-sonnet');
            expect(cost).toBe(0);
        });

        it('should scale cost with token count', () => {
            const cost1k = tracker.calculateCost(1000, 1000, 'gpt-4');
            const cost2k = tracker.calculateCost(2000, 2000, 'gpt-4');

            expect(cost2k).toBeCloseTo(cost1k * 2, 4);
        });
    });

    describe('trackUsage', () => {
        it('should track usage and accumulate daily cost', () => {
            tracker.trackUsage(1000, 500, 'claude-3.5-sonnet');
            tracker.trackUsage(2000, 1000, 'claude-3.5-sonnet');

            expect(tracker.getCallCount()).toBe(2);
            expect(tracker.getDailyCost()).toBeGreaterThan(0);
        });

        it('should return usage record with calculated cost', () => {
            const usage = tracker.trackUsage(1000, 500, 'claude-3.5-sonnet');

            expect(usage.inputTokens).toBe(1000);
            expect(usage.outputTokens).toBe(500);
            expect(usage.model).toBe('claude-3.5-sonnet');
            expect(usage.costUsd).toBeGreaterThan(0);
            expect(usage.timestamp).toBeInstanceOf(Date);
        });

        it('should preserve usage history', () => {
            tracker.trackUsage(1000, 500, 'claude-3.5-sonnet');
            tracker.trackUsage(2000, 1000, 'gpt-4');

            const history = tracker.getUsageHistory();
            expect(history).toHaveLength(2);
            expect(history[0].model).toBe('claude-3.5-sonnet');
            expect(history[1].model).toBe('gpt-4');
        });
    });

    describe('forceReset', () => {
        it('should reset all counters', () => {
            tracker.trackUsage(1000, 500, 'claude-3.5-sonnet');
            tracker.trackUsage(2000, 1000, 'gpt-4');

            tracker.forceReset();

            expect(tracker.getDailyCost()).toBe(0);
            expect(tracker.getCallCount()).toBe(0);
            expect(tracker.getUsageHistory()).toHaveLength(0);
        });
    });

    describe('getMsUntilReset', () => {
        it('should return positive value', () => {
            const msUntilReset = tracker.getMsUntilReset();
            expect(msUntilReset).toBeGreaterThan(0);
        });

        it('should return value less than 24 hours', () => {
            const msUntilReset = tracker.getMsUntilReset();
            const ms24Hours = 24 * 60 * 60 * 1000;
            expect(msUntilReset).toBeLessThanOrEqual(ms24Hours);
        });
    });
});

// ============================================
// BUDGETER TESTS
// ============================================

describe('Budgeter', () => {
    let budgeter: Budgeter;

    beforeEach(() => {
        budgeter = new Budgeter({
            dailyLimitUsd: 1.00,
            enabled: true,
            verbose: false,
            enableAuditLog: false,
        });
    });

    describe('trackAndCheck', () => {
        it('should return true when within budget', () => {
            const result = budgeter.trackAndCheck(100, 50, 'claude-3-haiku');
            expect(result).toBe(true);
        });

        it('should return false when budget exhausted', () => {
            // Set very low budget
            budgeter.updateConfig({ dailyLimitUsd: 0.0001 });

            // First call may exceed budget
            const result = budgeter.trackAndCheck(10000, 5000, 'gpt-4');
            expect(result).toBe(false);
        });

        it('should accumulate costs across multiple calls', () => {
            budgeter.trackAndCheck(1000, 500, 'claude-3.5-sonnet');
            budgeter.trackAndCheck(1000, 500, 'claude-3.5-sonnet');

            const status = budgeter.getStatus();
            expect(status.callCount).toBe(2);
            expect(status.dailyCost).toBeGreaterThan(0);
        });

        it('should pass through when disabled', () => {
            budgeter.updateConfig({ enabled: false });

            // Even with massive usage, should return true
            const result = budgeter.trackAndCheck(1000000, 500000, 'gpt-4');
            expect(result).toBe(true);
        });
    });

    describe('isKillSwitchCommand', () => {
        it('should recognize exact command', () => {
            expect(budgeter.isKillSwitchCommand('/sara-sleep-now')).toBe(true);
        });

        it('should recognize command with trailing text', () => {
            expect(budgeter.isKillSwitchCommand('/sara-sleep-now please')).toBe(true);
        });

        it('should be case insensitive', () => {
            expect(budgeter.isKillSwitchCommand('/SARA-SLEEP-NOW')).toBe(true);
            expect(budgeter.isKillSwitchCommand('/Sara-Sleep-Now')).toBe(true);
        });

        it('should handle whitespace', () => {
            expect(budgeter.isKillSwitchCommand('  /sara-sleep-now  ')).toBe(true);
        });

        it('should reject non-matching commands', () => {
            expect(budgeter.isKillSwitchCommand('/help')).toBe(false);
            expect(budgeter.isKillSwitchCommand('hello')).toBe(false);
            expect(budgeter.isKillSwitchCommand('/sara-wake-up')).toBe(false);
        });
    });

    describe('handleKillSwitch', () => {
        it('should emit EMERGENCY_KILL halt signal', () => {
            const signal = budgeter.handleKillSwitch('telegram');

            expect(signal.type).toBe('EMERGENCY_KILL');
            expect(signal.canAutoResume).toBe(false);
            expect(signal.reason).toContain('telegram');
        });

        it('should store halt signal', () => {
            budgeter.handleKillSwitch('whatsapp');

            const signal = budgeter.getHaltSignal();
            expect(signal).not.toBeNull();
            expect(signal?.type).toBe('EMERGENCY_KILL');
        });
    });

    describe('emitHalt', () => {
        it('should create BUDGET_EXHAUSTED signal with auto-resume', () => {
            const signal = budgeter.emitHalt('BUDGET_EXHAUSTED', 'Daily limit reached');

            expect(signal.type).toBe('BUDGET_EXHAUSTED');
            expect(signal.canAutoResume).toBe(true);
            expect(signal.resumeAt).toBeInstanceOf(Date);
        });

        it('should create EMERGENCY_KILL signal without auto-resume', () => {
            const signal = budgeter.emitHalt('EMERGENCY_KILL', 'User requested');

            expect(signal.type).toBe('EMERGENCY_KILL');
            expect(signal.canAutoResume).toBe(false);
            expect(signal.resumeAt).toBeUndefined();
        });
    });

    describe('getStatus', () => {
        it('should return correct budget status', () => {
            budgeter.trackAndCheck(1000, 500, 'claude-3.5-sonnet');

            const status = budgeter.getStatus();

            expect(status.dailyLimit).toBe(1.00);
            expect(status.dailyCost).toBeGreaterThan(0);
            expect(status.usagePercent).toBeGreaterThan(0);
            expect(status.callCount).toBe(1);
            expect(status.msUntilReset).toBeGreaterThan(0);
        });

        it('should detect budget exhaustion', () => {
            budgeter.updateConfig({ dailyLimitUsd: 0.0001 });
            budgeter.trackAndCheck(10000, 5000, 'gpt-4');

            const status = budgeter.getStatus();
            expect(status.isExhausted).toBe(true);
        });
    });

    describe('generateSleepMessage', () => {
        it('should generate budget exhaustion message', () => {
            budgeter.emitHalt('BUDGET_EXHAUSTED', 'test');
            const message = budgeter.generateSleepMessage();

            expect(message).toContain('dormir');
            expect(message).toContain('economizar');
            expect(message).toContain('$');
        });

        it('should generate emergency message for kill-switch', () => {
            budgeter.handleKillSwitch('test');
            const message = budgeter.generateSleepMessage();

            expect(message).toContain('emergência');
            expect(message).toContain('sono profundo');
        });
    });

    describe('callbacks', () => {
        it('should call onBudgetExhausted when budget is used up', () => {
            const callback = vi.fn();
            budgeter.updateConfig({
                dailyLimitUsd: 0.0001,
                onBudgetExhausted: callback,
            });

            budgeter.trackAndCheck(10000, 5000, 'gpt-4');

            expect(callback).toHaveBeenCalled();
        });

        it('should call onWarningThreshold when threshold reached', () => {
            const callback = vi.fn();
            budgeter.updateConfig({
                dailyLimitUsd: 0.001,
                warningThreshold: 0.5,
                onWarningThreshold: callback,
            });

            // Make calls until warning threshold
            budgeter.trackAndCheck(1000, 500, 'gpt-4');

            expect(callback).toHaveBeenCalled();
        });
    });

    describe('clearHaltSignal', () => {
        it('should clear the halt signal', () => {
            budgeter.handleKillSwitch('test');
            expect(budgeter.getHaltSignal()).not.toBeNull();

            budgeter.clearHaltSignal();
            expect(budgeter.getHaltSignal()).toBeNull();
        });
    });
});

// ============================================
// FACTORY TESTS
// ============================================

describe('createBudgeter', () => {
    it('should create budgeter with default config', () => {
        const budgeter = createBudgeter({ verbose: false, enableAuditLog: false });
        expect(budgeter).toBeInstanceOf(Budgeter);
    });

    it('should allow config overrides', () => {
        const budgeter = createBudgeter({
            dailyLimitUsd: 5.00,
            killSwitchCommand: '/custom-kill',
            verbose: false,
            enableAuditLog: false,
        });

        const status = budgeter.getStatus();
        expect(status.dailyLimit).toBe(5.00);
        expect(budgeter.isKillSwitchCommand('/custom-kill')).toBe(true);
    });
});

// ============================================
// TOKEN PRICING TESTS
// ============================================

describe('TOKEN_PRICING', () => {
    it('should have pricing for major providers', () => {
        expect(TOKEN_PRICING['claude-3.5-sonnet']).toBeDefined();
        expect(TOKEN_PRICING['gpt-4']).toBeDefined();
        expect(TOKEN_PRICING['gemini-pro']).toBeDefined();
    });

    it('should have default pricing', () => {
        expect(TOKEN_PRICING['default']).toBeDefined();
        expect(TOKEN_PRICING['default'].input).toBeGreaterThan(0);
        expect(TOKEN_PRICING['default'].output).toBeGreaterThan(0);
    });

    it('should have correct pricing structure', () => {
        for (const [model, pricing] of Object.entries(TOKEN_PRICING)) {
            expect(pricing.input).toBeTypeOf('number');
            expect(pricing.output).toBeTypeOf('number');
            expect(pricing.input).toBeGreaterThanOrEqual(0);
            expect(pricing.output).toBeGreaterThanOrEqual(0);
        }
    });
});
