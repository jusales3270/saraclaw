/**
 * Sara Shield Module - Security Audit Log
 * 
 * Dedicated logging for security events and leak attempts.
 * This log is separate from application logs for security review.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { CensorResult } from './the-censor.js';

/**
 * Security event types
 */
export type SecurityEventType =
    | 'leak_attempt'
    | 'leak_blocked'
    | 'pattern_match'
    | 'sandbox_violation'
    | 'rate_limit_exceeded'
    | 'auth_failure'
    | 'suspicious_activity';

/**
 * Security audit log entry
 */
export interface SecurityAuditEntry {
    /** Unique event ID */
    id: string;

    /** Event type */
    type: SecurityEventType;

    /** Timestamp */
    timestamp: Date;

    /** Severity level */
    severity: 'low' | 'medium' | 'high' | 'critical';

    /** Event description */
    description: string;

    /** Additional context */
    context: Record<string, unknown>;

    /** Session or request ID if available */
    sessionId?: string;

    /** Whether action was blocked */
    blocked: boolean;
}

/**
 * Security Audit Logger configuration
 */
export interface SecurityAuditConfig {
    /** Directory for security logs */
    logDir: string;

    /** Log file prefix */
    filePrefix: string;

    /** Rotate logs daily */
    rotateLogs: boolean;

    /** Also write to console */
    consoleOutput: boolean;

    /** Callback for critical events */
    onCritical?: (entry: SecurityAuditEntry) => void;
}

/**
 * Default configuration
 */
export const DEFAULT_AUDIT_CONFIG: SecurityAuditConfig = {
    logDir: process.env.SARA_SECURITY_LOG_DIR || '/home/node/.saraclaw/security-logs',
    filePrefix: 'security-audit',
    rotateLogs: true,
    consoleOutput: true,
};

/**
 * Security Audit Logger
 * 
 * Persistent logging for security events, separate from application logs.
 */
export class SecurityAuditLog {
    private config: SecurityAuditConfig;
    private entryCount: number = 0;

    constructor(config: Partial<SecurityAuditConfig> = {}) {
        this.config = { ...DEFAULT_AUDIT_CONFIG, ...config };
        this.ensureLogDir();
    }

    /**
     * Ensure log directory exists
     */
    private ensureLogDir(): void {
        if (!existsSync(this.config.logDir)) {
            mkdirSync(this.config.logDir, { recursive: true });
        }
    }

    /**
     * Get current log file path
     */
    private getLogFilePath(): string {
        if (this.config.rotateLogs) {
            const date = new Date().toISOString().split('T')[0];
            return join(this.config.logDir, `${this.config.filePrefix}-${date}.jsonl`);
        }
        return join(this.config.logDir, `${this.config.filePrefix}.jsonl`);
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    /**
     * Log a security event
     */
    log(
        type: SecurityEventType,
        severity: SecurityAuditEntry['severity'],
        description: string,
        context: Record<string, unknown> = {},
        sessionId?: string
    ): SecurityAuditEntry {
        const entry: SecurityAuditEntry = {
            id: this.generateEventId(),
            type,
            timestamp: new Date(),
            severity,
            description,
            context,
            sessionId,
            blocked: type === 'leak_blocked' || type === 'sandbox_violation',
        };

        // Write to file
        this.writeEntry(entry);

        // Console output
        if (this.config.consoleOutput) {
            this.logToConsole(entry);
        }

        // Critical callback
        if (severity === 'critical' && this.config.onCritical) {
            this.config.onCritical(entry);
        }

        this.entryCount++;
        return entry;
    }

    /**
     * Log a censor result (leak attempt)
     */
    logCensorResult(result: CensorResult, sessionId?: string): SecurityAuditEntry | null {
        if (!result.hasSensitiveData) {
            return null;
        }

        const severity = result.raiseAlert ? 'high' : 'medium';
        const type: SecurityEventType = 'leak_blocked';

        return this.log(
            type,
            severity,
            `Sensitive data blocked: ${result.matches.length} pattern(s) matched`,
            {
                matchCount: result.matches.length,
                patterns: result.matches.map(m => ({
                    type: m.type,
                    pattern: m.pattern,
                    severity: m.severity,
                    // Do NOT log the actual match - that would be a leak!
                    matchLength: m.match.length,
                })),
                outputLength: result.originalOutput.length,
                censoredLength: result.censoredOutput.length,
                redactedChars: result.originalOutput.length - result.censoredOutput.length +
                    (result.matches.length * '[REDACTED]'.length),
            },
            sessionId
        );
    }

    /**
     * Write entry to file
     */
    private writeEntry(entry: SecurityAuditEntry): void {
        const filePath = this.getLogFilePath();
        const line = JSON.stringify({
            ...entry,
            timestamp: entry.timestamp.toISOString(),
        }) + '\n';

        try {
            appendFileSync(filePath, line, 'utf-8');
        } catch (error) {
            console.error('[SecurityAudit] Failed to write to log file:', error);
        }
    }

    /**
     * Log to console with formatting
     */
    private logToConsole(entry: SecurityAuditEntry): void {
        const prefix = `[SECURITY:${entry.severity.toUpperCase()}]`;
        const message = `${prefix} [${entry.type}] ${entry.description}`;

        switch (entry.severity) {
            case 'critical':
                console.error('🚨', message);
                break;
            case 'high':
                console.warn('⚠️', message);
                break;
            case 'medium':
                console.warn('⚡', message);
                break;
            case 'low':
                console.log('📝', message);
                break;
        }
    }

    /**
     * Get recent entries from the log (for review)
     */
    getRecentEntries(limit: number = 50): SecurityAuditEntry[] {
        const filePath = this.getLogFilePath();

        if (!existsSync(filePath)) {
            return [];
        }

        try {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.trim().split('\n').filter(Boolean);

            return lines
                .slice(-limit)
                .map(line => {
                    const parsed = JSON.parse(line);
                    return {
                        ...parsed,
                        timestamp: new Date(parsed.timestamp),
                    };
                });
        } catch (error) {
            console.error('[SecurityAudit] Failed to read log file:', error);
            return [];
        }
    }

    /**
     * Get statistics
     */
    getStats(): { entriesLogged: number; logPath: string } {
        return {
            entriesLogged: this.entryCount,
            logPath: this.getLogFilePath(),
        };
    }
}

/**
 * Create a new security audit logger
 */
export function createSecurityAuditLog(config?: Partial<SecurityAuditConfig>): SecurityAuditLog {
    return new SecurityAuditLog(config);
}

/**
 * Global singleton for security logging (use with caution)
 */
let globalSecurityLog: SecurityAuditLog | null = null;

export function getSecurityLog(): SecurityAuditLog {
    if (!globalSecurityLog) {
        globalSecurityLog = createSecurityAuditLog();
    }
    return globalSecurityLog;
}
