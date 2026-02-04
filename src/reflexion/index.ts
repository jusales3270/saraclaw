/**
 * Sara Reflexion Module
 * 
 * Inner Monologue system for auditable decision-making.
 */

export * from './inner-monologue.js';
export * from './thought-log.js';

// Convenience re-exports
export { InnerMonologue, createInnerMonologue } from './inner-monologue.js';
export { createThoughtLog, formatThoughtEntry } from './thought-log.js';
export type { ThoughtEntry, ThoughtLog } from './thought-log.js';
export type { ReflexionResult, ReflexionTrigger, ReflexionDecision } from './inner-monologue.js';
