/**
 * Sara Reflexion Module - Thought Log
 * 
 * Persistence layer for thought audit logs.
 * Stores inner monologue entries locally for governance and debugging.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * A single thought entry in the audit log
 */
export interface ThoughtEntry {
    /** Unique identifier */
    id: string;

    /** Session this thought belongs to */
    sessionId: string;

    /** When the thought occurred */
    timestamp: Date;

    /** What triggered the thought */
    trigger: string;

    /** The reasoning chain */
    reasoning: string;

    /** Final decision made */
    decision: string;

    /** Justification for the decision */
    justification: string;

    /** Risk level assessed */
    riskLevel: string;

    /** Confidence score (0-1) */
    confidence: number;
}

/**
 * Thought log storage interface
 */
export interface ThoughtLog {
    /** Append a new thought entry */
    append(entry: ThoughtEntry): Promise<void>;

    /** Get recent thoughts for a session */
    getRecent(sessionId: string, limit: number): Promise<ThoughtEntry[]>;

    /** Get all thoughts for a session */
    getAll(sessionId: string): Promise<ThoughtEntry[]>;

    /** Clear old thoughts (retention policy) */
    prune(olderThanDays: number): Promise<number>;
}

/**
 * File-based thought log implementation
 */
class FileThoughtLog implements ThoughtLog {
    private logDir: string;

    constructor(logDir: string) {
        this.logDir = logDir;
        this.ensureDir();
    }

    private ensureDir(): void {
        if (!existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true });
        }
    }

    private getLogFilePath(sessionId: string): string {
        // Sanitize session ID for use as filename
        const safeId = sessionId.replace(/[^a-zA-Z0-9-_]/g, '_');
        return join(this.logDir, `thoughts_${safeId}.jsonl`);
    }

    async append(entry: ThoughtEntry): Promise<void> {
        const filePath = this.getLogFilePath(entry.sessionId);

        // Serialize entry as JSON line
        const line = JSON.stringify({
            ...entry,
            timestamp: entry.timestamp.toISOString(),
        }) + '\n';

        // Append to file
        const { appendFileSync } = await import('fs');
        appendFileSync(filePath, line, 'utf-8');
    }

    async getRecent(sessionId: string, limit: number): Promise<ThoughtEntry[]> {
        const all = await this.getAll(sessionId);
        return all.slice(-limit);
    }

    async getAll(sessionId: string): Promise<ThoughtEntry[]> {
        const filePath = this.getLogFilePath(sessionId);

        if (!existsSync(filePath)) {
            return [];
        }

        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);

        return lines.map(line => {
            const parsed = JSON.parse(line);
            return {
                ...parsed,
                timestamp: new Date(parsed.timestamp),
            };
        });
    }

    async prune(olderThanDays: number): Promise<number> {
        const { readdirSync, unlinkSync, statSync } = await import('fs');

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);

        let prunedCount = 0;

        const files = readdirSync(this.logDir);
        for (const file of files) {
            if (!file.startsWith('thoughts_')) continue;

            const filePath = join(this.logDir, file);
            const stats = statSync(filePath);

            if (stats.mtime < cutoff) {
                unlinkSync(filePath);
                prunedCount++;
            }
        }

        return prunedCount;
    }
}

/**
 * In-memory thought log for testing
 */
class MemoryThoughtLog implements ThoughtLog {
    private entries: Map<string, ThoughtEntry[]> = new Map();

    async append(entry: ThoughtEntry): Promise<void> {
        const sessionEntries = this.entries.get(entry.sessionId) || [];
        sessionEntries.push(entry);
        this.entries.set(entry.sessionId, sessionEntries);
    }

    async getRecent(sessionId: string, limit: number): Promise<ThoughtEntry[]> {
        const all = await this.getAll(sessionId);
        return all.slice(-limit);
    }

    async getAll(sessionId: string): Promise<ThoughtEntry[]> {
        return this.entries.get(sessionId) || [];
    }

    async prune(olderThanDays: number): Promise<number> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);

        let prunedCount = 0;

        for (const [sessionId, entries] of this.entries) {
            const filtered = entries.filter(e => e.timestamp >= cutoff);
            prunedCount += entries.length - filtered.length;
            this.entries.set(sessionId, filtered);
        }

        return prunedCount;
    }
}

/**
 * Default log directory path
 */
function getDefaultLogDir(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return join(homeDir, '.saraclaw', 'thought-logs');
}

/**
 * Create a thought log instance
 * @param logPath - Optional custom path for log storage. If not provided, uses default.
 *                  Pass 'memory' for in-memory storage (testing).
 */
export function createThoughtLog(logPath?: string): ThoughtLog {
    if (logPath === 'memory') {
        return new MemoryThoughtLog();
    }

    const dir = logPath || getDefaultLogDir();
    return new FileThoughtLog(dir);
}

/**
 * Format a thought entry as readable markdown
 */
export function formatThoughtEntry(entry: ThoughtEntry): string {
    return `### Thought ${entry.id}

**Session**: ${entry.sessionId}
**Timestamp**: ${entry.timestamp.toISOString()}
**Trigger**: ${entry.trigger}

#### Reasoning
${entry.reasoning}

#### Decision
- **Action**: ${entry.decision}
- **Justification**: ${entry.justification}
- **Risk Level**: ${entry.riskLevel}
- **Confidence**: ${(entry.confidence * 100).toFixed(0)}%

---
`;
}
