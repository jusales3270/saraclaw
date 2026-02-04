/**
 * Sara Heart Module - Pulse States
 * 
 * State machine implementation for Sara's autonomous heartbeat cycle:
 * IDLE → REFLEXION → ACTION → IDLE
 */

import { EventEmitter } from 'events';

/**
 * Heartbeat states
 */
export type PulseState = 'idle' | 'reflexion' | 'action';

/**
 * Events emitted by the pulse state machine
 */
export interface PulseEvents {
    /** State transition occurred */
    stateChange: (from: PulseState, to: PulseState) => void;

    /** Entering idle state */
    idle: () => void;

    /** Entering reflexion state */
    reflexion: () => void;

    /** Entering action state with insight data */
    action: (insight: InsightData) => void;

    /** Heartbeat cycle completed */
    cycleComplete: (result: CycleResult) => void;

    /** Error during cycle */
    error: (error: Error) => void;
}

/**
 * Data about an insight that triggered action state
 */
export interface InsightData {
    /** Source of the insight */
    source: 'openaugi' | 'recent_messages' | 'calendar' | 'pattern_match';

    /** Description of the insight */
    description: string;

    /** Value score (0-1) */
    valueScore: number;

    /** Urgency score (0-1) */
    urgencyScore: number;

    /** Suggested action */
    suggestedAction: 'notify' | 'execute_tool' | 'defer';

    /** Additional context */
    context?: Record<string, unknown>;
}

/**
 * Result of a complete heartbeat cycle
 */
export interface CycleResult {
    /** Cycle identifier */
    cycleId: string;

    /** When the cycle started */
    startedAt: Date;

    /** When the cycle ended */
    endedAt: Date;

    /** Duration in milliseconds */
    durationMs: number;

    /** Whether an action was taken */
    actionTaken: boolean;

    /** Insight that triggered action (if any) */
    insight?: InsightData;

    /** State sequence during this cycle */
    stateSequence: PulseState[];
}

/**
 * Type-safe event emitter for pulse events
 */
export class PulseEventEmitter extends EventEmitter {
    emit<K extends keyof PulseEvents>(event: K, ...args: Parameters<PulseEvents[K]>): boolean {
        return super.emit(event, ...args);
    }

    on<K extends keyof PulseEvents>(event: K, listener: PulseEvents[K]): this {
        return super.on(event, listener as (...args: unknown[]) => void);
    }

    once<K extends keyof PulseEvents>(event: K, listener: PulseEvents[K]): this {
        return super.once(event, listener as (...args: unknown[]) => void);
    }
}

/**
 * Pulse State Machine
 * 
 * Manages the heartbeat cycle state transitions.
 */
export class PulseStateMachine extends PulseEventEmitter {
    private currentState: PulseState = 'idle';
    private cycleId: string | null = null;
    private cycleStartedAt: Date | null = null;
    private stateSequence: PulseState[] = [];

    /**
     * Get the current pulse state
     */
    getState(): PulseState {
        return this.currentState;
    }

    /**
     * Check if currently in a cycle
     */
    isInCycle(): boolean {
        return this.cycleId !== null;
    }

    /**
     * Start a new heartbeat cycle
     */
    startCycle(): string {
        if (this.isInCycle()) {
            throw new Error('Cycle already in progress');
        }

        this.cycleId = this.generateCycleId();
        this.cycleStartedAt = new Date();
        this.stateSequence = ['idle'];

        return this.cycleId;
    }

    /**
     * Transition to a new state
     */
    transition(to: PulseState, insight?: InsightData): void {
        const from = this.currentState;

        // Validate transition
        if (!this.isValidTransition(from, to)) {
            throw new Error(`Invalid transition: ${from} → ${to}`);
        }

        this.currentState = to;
        this.stateSequence.push(to);

        // Emit state change event
        this.emit('stateChange', from, to);

        // Emit state-specific event
        switch (to) {
            case 'idle':
                this.emit('idle');
                break;
            case 'reflexion':
                this.emit('reflexion');
                break;
            case 'action':
                if (insight) {
                    this.emit('action', insight);
                }
                break;
        }
    }

    /**
     * Complete the current cycle
     */
    completeCycle(actionTaken: boolean, insight?: InsightData): CycleResult {
        if (!this.isInCycle()) {
            throw new Error('No cycle in progress');
        }

        const endedAt = new Date();
        const result: CycleResult = {
            cycleId: this.cycleId!,
            startedAt: this.cycleStartedAt!,
            endedAt,
            durationMs: endedAt.getTime() - this.cycleStartedAt!.getTime(),
            actionTaken,
            insight,
            stateSequence: [...this.stateSequence],
        };

        // Reset to idle
        this.transition('idle');

        // Clear cycle state
        this.cycleId = null;
        this.cycleStartedAt = null;
        this.stateSequence = [];

        // Emit cycle complete
        this.emit('cycleComplete', result);

        return result;
    }

    /**
     * Check if a state transition is valid
     */
    private isValidTransition(from: PulseState, to: PulseState): boolean {
        const validTransitions: Record<PulseState, PulseState[]> = {
            idle: ['reflexion', 'idle'],
            reflexion: ['action', 'idle'],
            action: ['idle'],
        };

        return validTransitions[from].includes(to);
    }

    /**
     * Generate a unique cycle ID
     */
    private generateCycleId(): string {
        const now = new Date();
        const dateStr = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const random = Math.random().toString(36).substring(2, 6);
        return `PULSE-${dateStr}-${random}`;
    }
}

/**
 * Create a new pulse state machine
 */
export function createPulseStateMachine(): PulseStateMachine {
    return new PulseStateMachine();
}

/**
 * Evaluate if an insight meets the threshold for action
 */
export function meetsActionThreshold(
    insight: InsightData,
    valueThreshold: number = 0.7,
    urgencyThreshold: number = 0.5
): boolean {
    // Action is triggered if value is high OR (value is medium AND urgency is high)
    const highValue = insight.valueScore >= valueThreshold;
    const mediumValueHighUrgency =
        insight.valueScore >= valueThreshold * 0.7 &&
        insight.urgencyScore >= urgencyThreshold;

    return highValue || mediumValueHighUrgency;
}
