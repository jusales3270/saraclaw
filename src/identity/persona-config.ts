/**
 * Sara Identity - Persona Configuration
 * 
 * Configuration for Sara's behavioral parameters and adaptive responses.
 */

/**
 * Heartbeat configuration for proactive autonomy
 */
export interface HeartbeatConfig {
    /** Interval in milliseconds between heartbeat cycles (default: 5 minutes) */
    intervalMs: number;

    /** Minimum insight score (0-1) required to trigger proactive action */
    actionThreshold: number;

    /** Maximum proactive actions per hour to prevent spam */
    maxActionsPerHour: number;

    /** Whether to enable autonomous reflexion */
    enableReflexion: boolean;

    /** Quiet hours during which proactive actions are suppressed */
    quietHours?: {
        start: number; // Hour in 24h format (0-23)
        end: number;
    };
}

/**
 * Security filter configuration
 */
export interface SecurityConfig {
    /** Enable The Censor output filter */
    enableCensor: boolean;

    /** Additional patterns to detect as sensitive (regex strings) */
    additionalPatterns: string[];

    /** Whether to log redaction events */
    logRedactions: boolean;

    /** Alert channel for security events */
    alertChannel?: 'telegram' | 'whatsapp' | 'log';
}

/**
 * OpenAugi integration configuration
 */
export interface OpenAugiConfig {
    /** Enable OpenAugi context enrichment */
    enabled: boolean;

    /** Path to the OpenAugi knowledge graph */
    repositoryPath?: string;

    /** Maximum context tokens to inject */
    maxContextTokens: number;

    /** Enable semantic search before responses */
    semanticSearchEnabled: boolean;
}

/**
 * Notification configuration for proactive whispers
 */
export interface NotificationConfig {
    /** Minimum score to save to journal (1-10, default: 7) */
    journalThreshold: number;

    /** Minimum score to notify user (1-10, default: 10) */
    notifyThreshold: number;

    /** Default notification channels */
    defaultChannels: ('telegram' | 'discord' | 'slack' | 'web')[];

    /** Enable context bridge (chat to memory) */
    enableContextBridge: boolean;

    /** Auto-summarize after N messages */
    autoSummarizeThreshold: number;

    /** Enable quiet hours for notifications */
    respectQuietHours: boolean;
}

/**
 * Complete Sara persona configuration
 */
export interface SaraPersonaConfig {
    heartbeat: HeartbeatConfig;
    security: SecurityConfig;
    openAugi: OpenAugiConfig;
    notification: NotificationConfig;

    /** Custom identity overrides */
    identity?: {
        name?: string;
        customTraits?: string[];
        customPrinciples?: string[];
    };
}

/**
 * Default configuration for Sara
 */
export const DEFAULT_PERSONA_CONFIG: SaraPersonaConfig = {
    heartbeat: {
        intervalMs: 5 * 60 * 1000, // 5 minutes
        actionThreshold: 0.7,
        maxActionsPerHour: 3,
        enableReflexion: true,
        quietHours: {
            start: 23, // 11 PM
            end: 7,    // 7 AM
        },
    },

    security: {
        enableCensor: true,
        additionalPatterns: [],
        logRedactions: true,
        alertChannel: 'log',
    },

    openAugi: {
        enabled: false, // Disabled until configured
        maxContextTokens: 2000,
        semanticSearchEnabled: true,
    },

    notification: {
        journalThreshold: 7,    // Score 7+: save to journal
        notifyThreshold: 10,    // Score 10: notify user
        defaultChannels: ['telegram'],
        enableContextBridge: true,
        autoSummarizeThreshold: 10,
        respectQuietHours: true,
    },
};

/**
 * Load persona configuration from environment or defaults
 */
export function loadPersonaConfig(): SaraPersonaConfig {
    const config = { ...DEFAULT_PERSONA_CONFIG };

    // Override from environment variables if present
    if (process.env.SARA_HEARTBEAT_INTERVAL_MS) {
        config.heartbeat.intervalMs = parseInt(process.env.SARA_HEARTBEAT_INTERVAL_MS, 10);
    }

    if (process.env.SARA_ACTION_THRESHOLD) {
        config.heartbeat.actionThreshold = parseFloat(process.env.SARA_ACTION_THRESHOLD);
    }

    if (process.env.SARA_OPENAUGI_PATH) {
        config.openAugi.enabled = true;
        config.openAugi.repositoryPath = process.env.SARA_OPENAUGI_PATH;
    }

    if (process.env.SARA_DISABLE_CENSOR === 'true') {
        config.security.enableCensor = false;
    }

    return config;
}

/**
 * Validate persona configuration
 */
export function validatePersonaConfig(config: SaraPersonaConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.heartbeat.intervalMs < 60000) {
        errors.push('Heartbeat interval must be at least 60 seconds');
    }

    if (config.heartbeat.actionThreshold < 0 || config.heartbeat.actionThreshold > 1) {
        errors.push('Action threshold must be between 0 and 1');
    }

    if (config.heartbeat.maxActionsPerHour < 1) {
        errors.push('Max actions per hour must be at least 1');
    }

    if (config.openAugi.enabled && !config.openAugi.repositoryPath) {
        errors.push('OpenAugi repository path required when enabled');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
