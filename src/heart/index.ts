/**
 * Sara Heart Module
 * 
 * Proactive autonomy engine - Sara's "pulse".
 * Includes: Heartbeat, Curiosity Engine, Scheduler
 */

export * from './pulse-states.js';
export * from './scheduler.js';
export * from './insights-detector.js';
export * from './curiosity-engine.js';
export * from './pulse.js';

// Convenience re-exports
export {
    PulseStateMachine,
    createPulseStateMachine,
    meetsActionThreshold,
} from './pulse-states.js';

export {
    SaraScheduler,
    createScheduler,
} from './scheduler.js';

export {
    InsightsDetector,
    createInsightsDetector,
    scoreInsight,
    getTopInsight,
} from './insights-detector.js';

export {
    CuriosityEngine,
    createCuriosityEngine,
    createConservativeCuriosityEngine,
    createCuriousCuriosityEngine,
    buildKnowledgeContext,
    DEFAULT_CURIOSITY_CONFIG,
} from './curiosity-engine.js';

export {
    runIntegratedPulse,
} from './pulse.js';

export type {
    PulseState,
    InsightData,
    CycleResult,
} from './pulse-states.js';

export type {
    KnowledgeContext,
    KnowledgeGap,
    CuriosityDecision,
    CuriosityConfig,
} from './curiosity-engine.js';

export type {
    SignalType,
    RawSignal,
    PatternMatch,
} from './insights-detector.js';
