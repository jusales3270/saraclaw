/**
 * Sara Scout - Budget Tracker
 * 
 * Tracks token economy metrics comparing WebMCP (structured) vs CUA (vision) costs.
 * Provides real-time savings statistics for the Budgeter integration.
 */

import type {
    BudgetEntry,
    BudgetStats,
    AccessPath,
    ScoutConfig,
} from './scout-types.js';
import { DEFAULT_SCOUT_CONFIG } from './scout-types.js';

// ============================================
// BUDGET TRACKER
// ============================================

/**
 * Budget Tracker
 * 
 * Records and aggregates token usage across WebMCP and CUA access paths.
 * Provides savings estimates and usage statistics.
 */
export class BudgetTracker {
    private config: ScoutConfig;
    private entries: BudgetEntry[] = [];
    private idCounter: number = 0;

    constructor(config: Partial<ScoutConfig> = {}) {
        this.config = { ...DEFAULT_SCOUT_CONFIG, ...config };
    }

    /**
     * Record a new budget entry for a browser interaction.
     */
    record(entry: BudgetEntry): void {
        this.entries.push(entry);
        this.log(`Recorded ${entry.path} access to ${entry.url} — ${entry.tokensSaved} tokens saved`);
    }

    /**
     * Create and record a budget entry from path and URL.
     */
    track(url: string, path: AccessPath): BudgetEntry {
        const tokensUsed = path === 'webmcp'
            ? this.config.webmcpTokenEstimate
            : this.config.cuaTokenEstimate;

        const tokensAlternative = path === 'webmcp'
            ? this.config.cuaTokenEstimate
            : this.config.webmcpTokenEstimate;

        const entry: BudgetEntry = {
            id: `budget-${++this.idCounter}`,
            url,
            path,
            tokensUsed,
            tokensAlternative,
            tokensSaved: tokensAlternative - tokensUsed,
            timestamp: new Date(),
        };

        this.record(entry);
        return entry;
    }

    /**
     * Get aggregated budget statistics.
     */
    getStats(): BudgetStats {
        const webmcpEntries = this.entries.filter(e => e.path === 'webmcp');
        const cuaEntries = this.entries.filter(e => e.path === 'cua');

        const totalRequests = this.entries.length;
        const webmcpCount = webmcpEntries.length;
        const cuaCount = cuaEntries.length;

        const estimatedTokensSaved = this.entries.reduce(
            (sum, e) => sum + Math.max(0, e.tokensSaved),
            0
        );

        const avgTokensWebMCP = webmcpCount > 0
            ? webmcpEntries.reduce((s, e) => s + e.tokensUsed, 0) / webmcpCount
            : 0;

        const avgTokensCUA = cuaCount > 0
            ? cuaEntries.reduce((s, e) => s + e.tokensUsed, 0) / cuaCount
            : 0;

        const webmcpHitRate = totalRequests > 0
            ? webmcpCount / totalRequests
            : 0;

        return {
            totalRequests,
            webmcpCount,
            cuaCount,
            estimatedTokensSaved,
            avgTokensWebMCP,
            avgTokensCUA,
            webmcpHitRate,
        };
    }

    /**
     * Get entries within a time range.
     */
    getEntriesSince(since: Date): BudgetEntry[] {
        return this.entries.filter(e => e.timestamp >= since);
    }

    /**
     * Get the last N entries.
     */
    getRecentEntries(limit: number = 20): BudgetEntry[] {
        return this.entries.slice(-limit);
    }

    /**
     * Generate a human-readable summary of budget performance.
     */
    getSummary(): string {
        const stats = this.getStats();

        if (stats.totalRequests === 0) {
            return '## Budget Tracker\nNo requests recorded yet.';
        }

        const lines = [
            '## Budget Tracker Summary',
            '',
            `**Total Requests:** ${stats.totalRequests}`,
            `**WebMCP Requests:** ${stats.webmcpCount} (${(stats.webmcpHitRate * 100).toFixed(1)}%)`,
            `**CUA Requests:** ${stats.cuaCount}`,
            '',
            `### Token Economy`,
            `- **Estimated Tokens Saved:** ${stats.estimatedTokensSaved.toLocaleString()}`,
            `- **Avg Tokens (WebMCP):** ${stats.avgTokensWebMCP.toFixed(0)}`,
            `- **Avg Tokens (CUA):** ${stats.avgTokensCUA.toFixed(0)}`,
        ];

        if (stats.estimatedTokensSaved > 0) {
            const savingsPercent = (stats.estimatedTokensSaved / (stats.estimatedTokensSaved + this.entries.reduce((s, e) => s + e.tokensUsed, 0))) * 100;
            lines.push(`- **Savings Rate:** ${savingsPercent.toFixed(1)}%`);
        }

        return lines.join('\n');
    }

    /**
     * Clear all tracked entries.
     */
    clear(): void {
        this.entries = [];
        this.idCounter = 0;
    }

    /**
     * Get total entry count.
     */
    getEntryCount(): number {
        return this.entries.length;
    }

    // ============================================
    // LOGGING
    // ============================================

    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[Scout:Budget] ${message}`);
        }
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a BudgetTracker instance.
 */
export function createBudgetTracker(config?: Partial<ScoutConfig>): BudgetTracker {
    return new BudgetTracker(config);
}
