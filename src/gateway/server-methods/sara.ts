/**
 * Sara Status - Gateway Methods
 * 
 * Exposes Sara's internal state to the UI dashboard:
 * - Scheduler state (IDLE/PULSING/BUDGET_EXHAUSTED)
 * - Budget status (cost, limit, percentage)
 * - Security stats (censor/jail events)
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

// ============================================
// TYPES
// ============================================

/** Sara scheduler state */
export type SaraSchedulerState = 'STOPPED' | 'IDLE' | 'PULSING' | 'ERROR' | 'SHUTDOWN' | 'BUDGET_EXHAUSTED';

/** Sara status response */
export interface SaraStatusResponse {
    scheduler: {
        state: SaraSchedulerState;
        uptime: number;
        nextPulseAt: string | null;
        lastPulseAt: string | null;
        metrics: {
            total: number;
            successful: number;
            failed: number;
            research: number;
            idle: number;
        };
    };
    budget: {
        dailyCost: number;
        dailyLimit: number;
        usagePercent: number;
        isExhausted: boolean;
        msUntilReset: number;
    };
    security: {
        censorEvents: number;
        jailEvents: number;
        lastIncident: string | null;
    };
    monologue: {
        lastEntries: string[];
        curiosityLevel: number;
    };
}

// ============================================
// STATE (In-memory, updated by Sara modules)
// ============================================

/** Sara runtime state - updated by scheduler and other modules */
let saraState: SaraStatusResponse = {
    scheduler: {
        state: 'STOPPED',
        uptime: 0,
        nextPulseAt: null,
        lastPulseAt: null,
        metrics: {
            total: 0,
            successful: 0,
            failed: 0,
            research: 0,
            idle: 0,
        },
    },
    budget: {
        dailyCost: 0,
        dailyLimit: 2.00,
        usagePercent: 0,
        isExhausted: false,
        msUntilReset: 0,
    },
    security: {
        censorEvents: 0,
        jailEvents: 0,
        lastIncident: null,
    },
    monologue: {
        lastEntries: [],
        curiosityLevel: 0,
    },
};

const startedAt = Date.now();

// ============================================
// STATE UPDATERS (called by Sara modules)
// ============================================

/** Update scheduler state (called by SaraScheduler) */
export function updateSaraSchedulerState(update: Partial<SaraStatusResponse['scheduler']>): void {
    saraState.scheduler = { ...saraState.scheduler, ...update };
}

/** Update budget state (called by Budgeter) */
export function updateSaraBudgetState(update: Partial<SaraStatusResponse['budget']>): void {
    saraState.budget = { ...saraState.budget, ...update };
}

/** Update security state (called by TheCensor/NetworkJail) */
export function updateSaraSecurityState(update: Partial<SaraStatusResponse['security']>): void {
    saraState.security = { ...saraState.security, ...update };
}

/** Increment censor event count */
export function incrementCensorEvent(): void {
    saraState.security.censorEvents++;
    saraState.security.lastIncident = new Date().toISOString();
}

/** Increment jail event count */
export function incrementJailEvent(): void {
    saraState.security.jailEvents++;
    saraState.security.lastIncident = new Date().toISOString();
}

/** Add monologue entry (called by Reflexion) */
export function addMonologueEntry(entry: string): void {
    saraState.monologue.lastEntries.push(entry);
    // Keep only last 50 entries
    if (saraState.monologue.lastEntries.length > 50) {
        saraState.monologue.lastEntries.shift();
    }
}

/** Update curiosity level */
export function updateCuriosityLevel(level: number): void {
    saraState.monologue.curiosityLevel = Math.max(0, Math.min(1, level));
}

// ============================================
// GATEWAY HANDLERS
// ============================================

export const saraHandlers: GatewayRequestHandlers = {
    /** Get Sara's current status */
    "sara.status": async ({ respond }) => {
        const uptime = Date.now() - startedAt;
        const status: SaraStatusResponse = {
            ...saraState,
            scheduler: {
                ...saraState.scheduler,
                uptime,
            },
        };
        respond(true, status, undefined);
    },

    /** Trigger emergency stop (kill-switch) */
    "sara.emergency-stop": async ({ respond, params }) => {
        const source = (params as { source?: string })?.source || 'ui';

        // Update state immediately
        saraState.scheduler.state = 'SHUTDOWN';

        // Log the event
        addMonologueEntry(`🚨 EMERGENCY STOP triggered by ${source}`);

        respond(true, {
            success: true,
            message: 'Sara entering emergency shutdown',
            source,
        }, undefined);
    },

    /** Get monologue entries (for real-time feed) */
    "sara.monologue": async ({ respond, params }) => {
        const limit = Math.min((params as { limit?: number })?.limit || 20, 50);
        const entries = saraState.monologue.lastEntries.slice(-limit);

        respond(true, {
            entries,
            curiosityLevel: saraState.monologue.curiosityLevel,
        }, undefined);
    },
};

// ============================================
// EXPORTS
// ============================================

export { saraState };
