/**
 * Sara Identity Module
 * 
 * Central export point for Sara's identity system.
 */

export * from './system-prompts.js';
export * from './persona-config.js';

// Re-export key constants for convenience
export { SARA_IDENTITY } from './system-prompts.js';
export { DEFAULT_PERSONA_CONFIG } from './persona-config.js';
