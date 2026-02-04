/**
 * Sara Heart Module
 * 
 * Proactive autonomy engine - Sara's "pulse".
 */

export * from './pulse-states.js';
export * from './scheduler.js';
export * from './insights-detector.js';

// Convenience re-exports
export {
    PulseStateMachine,
    createPulseStateMachine,
    meetsActionThreshold,
} from './pulse-states.js';

export {
    HeartbeatScheduler,
    createHeartbeatScheduler,
} from './scheduler.js';

export {
    InsightsDetector,
    createInsightsDetector,
    scoreInsight,
    getTopInsight,
} from './insights-detector.js';

export type {
    PulseState,
    InsightData,
    CycleResult,
} from './pulse-states.js';

export type {
    HeartbeatSchedulerOptions,
    SchedulerStats,
} from './scheduler.js';

export type {
    SignalType,
    RawSignal,
    PatternMatch,
} from './insights-detector.js';
