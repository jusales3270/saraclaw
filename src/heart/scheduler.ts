/**
 * Sara Heart Module - Scheduler
 * 
 * High-fidelity cron integration for autonomous reflexion cycles.
 */

import {
    PulseStateMachine,
    createPulseStateMachine,
    InsightData,
    CycleResult,
    meetsActionThreshold
} from './pulse-states.js';
import { createInnerMonologue, InnerMonologue } from '../reflexion/index.js';
import { loadPersonaConfig, SaraPersonaConfig } from '../identity/index.js';

/**
 * Heartbeat scheduler options
 */
export interface HeartbeatSchedulerOptions {
    /** Interval between heartbeat cycles in milliseconds */
    intervalMs?: number;

    /** Action threshold for triggering proactive actions */
    actionThreshold?: number;

    /** Maximum actions per hour */
    maxActionsPerHour?: number;

    /** Session ID for thought logging */
    sessionId?: string;

    /** Callback for proactive notifications */
    onProactiveNotification?: (insight: InsightData, message: string) => Promise<void>;

    /** Callback for data fetching (OpenAugi, messages, etc.) */
    onFetchContext?: () => Promise<{
        openAugiContext?: string;
        recentMessages?: string[];
        signals?: string[];
    }>;

    /** Quiet hours configuration */
    quietHours?: {
        start: number;
        end: number;
    };
}

/**
 * Heartbeat scheduler statistics
 */
export interface SchedulerStats {
    /** Total cycles executed */
    totalCycles: number;

    /** Cycles that resulted in action */
    actionCycles: number;

    /** Actions in the current hour */
    actionsThisHour: number;

    /** Hour of last action count reset */
    lastHourReset: number;

    /** Whether scheduler is running */
    isRunning: boolean;

    /** Last cycle result */
    lastCycleResult?: CycleResult;
}

/**
 * Heartbeat Scheduler
 * 
 * Manages the autonomous heartbeat cycle for Sara's proactive intelligence.
 */
export class HeartbeatScheduler {
    private pulseMachine: PulseStateMachine;
    private innerMonologue: InnerMonologue;
    private options: Required<HeartbeatSchedulerOptions>;
    private timer: ReturnType<typeof setInterval> | null = null;
    private stats: SchedulerStats;

    constructor(options: HeartbeatSchedulerOptions = {}) {
        const config = loadPersonaConfig();

        this.options = {
            intervalMs: options.intervalMs ?? config.heartbeat.intervalMs,
            actionThreshold: options.actionThreshold ?? config.heartbeat.actionThreshold,
            maxActionsPerHour: options.maxActionsPerHour ?? config.heartbeat.maxActionsPerHour,
            sessionId: options.sessionId ?? `sara-${Date.now()}`,
            quietHours: options.quietHours ?? config.heartbeat.quietHours ?? { start: 23, end: 7 },
            onProactiveNotification: options.onProactiveNotification ?? (async () => { }),
            onFetchContext: options.onFetchContext ?? (async () => ({})),
        };

        this.pulseMachine = createPulseStateMachine();
        this.innerMonologue = createInnerMonologue(this.options.sessionId);

        this.stats = {
            totalCycles: 0,
            actionCycles: 0,
            actionsThisHour: 0,
            lastHourReset: new Date().getHours(),
            isRunning: false,
        };

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Start the heartbeat scheduler
     */
    start(): void {
        if (this.stats.isRunning) {
            console.warn('[Heart] Scheduler already running');
            return;
        }

        console.log(`[Heart] Starting heartbeat scheduler (interval: ${this.options.intervalMs}ms)`);

        this.stats.isRunning = true;

        // Run first cycle immediately
        this.runCycle().catch(err => {
            console.error('[Heart] Error in initial cycle:', err);
        });

        // Schedule recurring cycles
        this.timer = setInterval(() => {
            this.runCycle().catch(err => {
                console.error('[Heart] Error in cycle:', err);
            });
        }, this.options.intervalMs);
    }

    /**
     * Stop the heartbeat scheduler
     */
    stop(): void {
        if (!this.stats.isRunning) {
            return;
        }

        console.log('[Heart] Stopping heartbeat scheduler');

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.stats.isRunning = false;
    }

    /**
     * Get scheduler statistics
     */
    getStats(): SchedulerStats {
        return { ...this.stats };
    }

    /**
     * Check if currently in quiet hours
     */
    isQuietHours(): boolean {
        const hour = new Date().getHours();
        const { start, end } = this.options.quietHours;

        // Handle wrap-around (e.g., 23:00 to 07:00)
        if (start > end) {
            return hour >= start || hour < end;
        }

        return hour >= start && hour < end;
    }

    /**
     * Run a single heartbeat cycle
     */
    async runCycle(): Promise<CycleResult | null> {
        // Check quiet hours
        if (this.isQuietHours()) {
            console.log('[Heart] Skipping cycle (quiet hours)');
            return null;
        }

        // Check action rate limit
        this.resetHourlyCounterIfNeeded();

        // Start cycle
        const cycleId = this.pulseMachine.startCycle();
        console.log(`[Heart] Starting cycle ${cycleId}`);

        try {
            // Transition to REFLEXION
            this.pulseMachine.transition('reflexion');

            // Fetch context
            const context = await this.options.onFetchContext();

            // Run inner monologue reflexion
            const reflexionResult = await this.innerMonologue.reflect({
                trigger: 'heartbeat_cycle',
                inputData: [
                    ...(context.recentMessages || []),
                    ...(context.signals || []),
                ],
                openAugiContext: context.openAugiContext,
                currentState: 'reflexion',
            });

            // Evaluate for action
            let actionTaken = false;
            let insight: InsightData | undefined;

            if (
                reflexionResult.decision === 'proactive_notification' &&
                reflexionResult.confidence >= this.options.actionThreshold
            ) {
                // Build insight data
                insight = {
                    source: context.openAugiContext ? 'openaugi' : 'recent_messages',
                    description: reflexionResult.justification,
                    valueScore: reflexionResult.confidence,
                    urgencyScore: reflexionResult.riskLevel === 'high' ? 0.8 : 0.5,
                    suggestedAction: 'notify',
                };

                // Check if meets threshold and not rate limited
                if (
                    meetsActionThreshold(insight, this.options.actionThreshold) &&
                    this.stats.actionsThisHour < this.options.maxActionsPerHour
                ) {
                    // Transition to ACTION
                    this.pulseMachine.transition('action', insight);

                    // Execute proactive notification
                    await this.options.onProactiveNotification(
                        insight,
                        reflexionResult.justification
                    );

                    actionTaken = true;
                    this.stats.actionsThisHour++;
                    this.stats.actionCycles++;
                }
            }

            // Complete cycle
            const result = this.pulseMachine.completeCycle(actionTaken, insight);

            this.stats.totalCycles++;
            this.stats.lastCycleResult = result;

            console.log(`[Heart] Cycle ${cycleId} complete (action: ${actionTaken})`);

            return result;

        } catch (error) {
            console.error(`[Heart] Cycle ${cycleId} failed:`, error);

            // Force back to idle
            this.pulseMachine.completeCycle(false);
            this.stats.totalCycles++;

            throw error;
        }
    }

    /**
     * Reset hourly counter if hour changed
     */
    private resetHourlyCounterIfNeeded(): void {
        const currentHour = new Date().getHours();

        if (currentHour !== this.stats.lastHourReset) {
            this.stats.actionsThisHour = 0;
            this.stats.lastHourReset = currentHour;
        }
    }

    /**
     * Set up event listeners for the pulse machine
     */
    private setupEventListeners(): void {
        this.pulseMachine.on('stateChange', (from, to) => {
            console.log(`[Heart] State: ${from} → ${to}`);
        });

        this.pulseMachine.on('error', (error) => {
            console.error('[Heart] Pulse machine error:', error);
        });
    }
}

/**
 * Create a new heartbeat scheduler
 */
export function createHeartbeatScheduler(options?: HeartbeatSchedulerOptions): HeartbeatScheduler {
    return new HeartbeatScheduler(options);
}
