/**
 * Sara Shield Module - The Censor
 * 
 * Output filtering middleware for security.
 * Scans all outbound strings for sensitive data patterns.
 */

import { SENSITIVE_PATTERNS, PatternType, PatternMatch as SensitiveMatch } from './patterns.js';
import { SecurityAuditLog, createSecurityAuditLog } from './security-audit-log.js';

/**
 * Result of a censorship scan
 */
export interface CensorResult {
    /** Whether any sensitive data was found */
    hasSensitiveData: boolean;

    /** The censored output (if any matches found) */
    censoredOutput: string;

    /** Original output (for logging) */
    originalOutput: string;

    /** Matches found */
    matches: SensitiveMatch[];

    /** Whether a security alert should be raised */
    raiseAlert: boolean;

    /** Timestamp of the scan */
    timestamp: Date;
}

/**
 * Censor configuration
 */
export interface CensorConfig {
    /** Enable censorship */
    enabled: boolean;

    /** Replacement text for redacted content */
    replacementText: string;

    /** Pattern types to scan for */
    patternTypes: PatternType[];

    /** Additional custom patterns (regex strings) */
    customPatterns: string[];

    /** Log all scans (even clean ones) */
    logAllScans: boolean;

    /** Enable security audit logging (persisted to file) */
    enableAuditLog: boolean;

    /** Callback when sensitive data is detected */
    onDetection?: (result: CensorResult) => void;
}

/**
 * Default censor configuration
 */
export const DEFAULT_CENSOR_CONFIG: CensorConfig = {
    enabled: true,
    replacementText: '[REDACTED]',
    patternTypes: ['api_key', 'secret', 'credential', 'pii', 'fiscal'],
    customPatterns: [],
    logAllScans: false,
    enableAuditLog: true,
};

/**
 * The Censor - Output filtering middleware
 */
export class TheCensor {
    private config: CensorConfig;
    private scanCount: number = 0;
    private redactionCount: number = 0;
    private securityLog: SecurityAuditLog | null = null;
    private sessionId?: string;

    constructor(config: Partial<CensorConfig> = {}, sessionId?: string) {
        this.config = { ...DEFAULT_CENSOR_CONFIG, ...config };
        this.sessionId = sessionId;

        if (this.config.enableAuditLog) {
            this.securityLog = createSecurityAuditLog();
        }
    }

    /**
     * Scan and censor a string for sensitive data
     */
    censor(output: string): CensorResult {
        this.scanCount++;

        if (!this.config.enabled) {
            return {
                hasSensitiveData: false,
                censoredOutput: output,
                originalOutput: output,
                matches: [],
                raiseAlert: false,
                timestamp: new Date(),
            };
        }

        const matches: SensitiveMatch[] = [];
        let censoredOutput = output;

        // Scan for built-in patterns
        for (const patternDef of SENSITIVE_PATTERNS) {
            if (!this.config.patternTypes.includes(patternDef.type)) {
                continue;
            }

            const regex = new RegExp(patternDef.pattern, 'gi');
            let match: RegExpExecArray | null;

            while ((match = regex.exec(output)) !== null) {
                matches.push({
                    type: patternDef.type,
                    pattern: patternDef.name,
                    match: match[0],
                    index: match.index,
                    severity: patternDef.severity,
                });
            }
        }

        // Scan for custom patterns
        for (const customPattern of this.config.customPatterns) {
            try {
                const regex = new RegExp(customPattern, 'gi');
                let match: RegExpExecArray | null;

                while ((match = regex.exec(output)) !== null) {
                    matches.push({
                        type: 'custom',
                        pattern: 'custom',
                        match: match[0],
                        index: match.index,
                        severity: 'high',
                    });
                }
            } catch (error) {
                console.warn(`[Censor] Invalid custom pattern: ${customPattern}`);
            }
        }

        // Apply redactions
        if (matches.length > 0) {
            // Sort matches by index (descending) to replace from end to start
            const sortedMatches = [...matches].sort((a, b) => b.index - a.index);

            for (const m of sortedMatches) {
                censoredOutput =
                    censoredOutput.slice(0, m.index) +
                    this.config.replacementText +
                    censoredOutput.slice(m.index + m.match.length);
            }

            this.redactionCount += matches.length;
        }

        const hasSensitiveData = matches.length > 0;
        const raiseAlert = matches.some(m => m.severity === 'critical' || m.severity === 'high');

        const result: CensorResult = {
            hasSensitiveData,
            censoredOutput,
            originalOutput: output,
            matches,
            raiseAlert,
            timestamp: new Date(),
        };

        // Callback on detection
        if (hasSensitiveData && this.config.onDetection) {
            this.config.onDetection(result);
        }

        // Persistent security audit log (Teste do Espelho)
        if (hasSensitiveData && this.securityLog) {
            this.securityLog.logCensorResult(result, this.sessionId);
        }

        // Console log if configured
        if (this.config.logAllScans || hasSensitiveData) {
            this.logScan(result);
        }

        return result;
    }

    /**
     * Check if a string contains sensitive data (without redacting)
     */
    check(text: string): boolean {
        const result = this.censor(text);
        return result.hasSensitiveData;
    }

    /**
     * Get statistics
     */
    getStats(): { scanCount: number; redactionCount: number } {
        return {
            scanCount: this.scanCount,
            redactionCount: this.redactionCount,
        };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<CensorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Log a scan result
     */
    private logScan(result: CensorResult): void {
        if (result.hasSensitiveData) {
            console.warn(
                `[Censor] ALERT: Sensitive data detected (${result.matches.length} matches)`,
                result.matches.map(m => ({ type: m.type, pattern: m.pattern, severity: m.severity }))
            );
        } else if (this.config.logAllScans) {
            console.log('[Censor] Scan complete: clean');
        }
    }
}

/**
 * Create a new Censor instance
 */
export function createCensor(config?: Partial<CensorConfig>): TheCensor {
    return new TheCensor(config);
}

/**
 * Middleware function for censoring output
 */
export function censorMiddleware(
    config?: Partial<CensorConfig>
): (output: string) => string {
    const censor = createCensor(config);

    return (output: string): string => {
        const result = censor.censor(output);
        return result.censoredOutput;
    };
}
