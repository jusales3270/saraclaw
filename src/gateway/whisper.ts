/**
 * Sara Gateway - Whisper (Proactive Notification Handler)
 * 
 * Handles Sara's proactive communication - reaching out when she has
 * something important to share (insight score 10/10).
 * 
 * Flow: Heartbeat → CuriosityEngine → Action → Synthesis → Whisper → User
 * 
 * The Whisper has a "Notification Threshold":
 * - Score < 7: Silent (no action)
 * - Score 7-9: Journal only (write to diary)
 * - Score 10: Notify user (push message)
 */

import { JournalWriter, createJournalWriter } from '../../packages/sara-memory/src/writer.js';

// ============================================
// TYPES
// ============================================

/** Insight significance score (1-10) */
export type InsightScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Notification threshold actions */
export type ThresholdAction = 'silent' | 'journal' | 'notify';

/** Insight data from pulse */
export interface InsightData {
    /** Topic of the insight */
    topic: string;

    /** Main insight content */
    content: string;

    /** Significance score (1-10) */
    score: InsightScore;

    /** Supporting evidence */
    evidence?: string[];

    /** Related previous insights */
    relatedInsights?: string[];

    /** Source URLs (if from research) */
    sources?: string[];

    /** Pulse number that generated this */
    pulseNumber: number;

    /** Timestamp */
    timestamp: Date;
}

/** Notification to send to user */
export interface ProactiveNotification {
    /** Notification ID */
    id: string;

    /** Target channels */
    channels: string[];

    /** Title/headline */
    title: string;

    /** Message content */
    content: string;

    /** Priority level */
    priority: 'low' | 'medium' | 'high' | 'urgent';

    /** Insight score that triggered this */
    insightScore: InsightScore;

    /** Delivery status */
    status: 'pending' | 'sent' | 'failed';

    /** Created at */
    createdAt: Date;

    /** Sent at */
    sentAt?: Date;
}

/** Whisper configuration */
export interface WhisperConfig {
    /** Minimum score to journal (default: 7) */
    journalThreshold: InsightScore;

    /** Minimum score to notify user (default: 10) */
    notifyThreshold: InsightScore;

    /** Default notification channels */
    defaultChannels: string[];

    /** OpenAugi path for journaling */
    openAugiPath: string;

    /** Dry run mode (no actual notifications) */
    dryRun: boolean;

    /** Verbose logging */
    verbose: boolean;
}

/** Default configuration */
const DEFAULT_WHISPER_CONFIG: WhisperConfig = {
    journalThreshold: 7,
    notifyThreshold: 10,
    defaultChannels: ['telegram'],
    openAugiPath: './tests/sample-openaugi',
    dryRun: true,
    verbose: true,
};

// ============================================
// WHISPER HANDLER
// ============================================

/**
 * Whisper - Proactive Notification Handler
 * 
 * Decides when Sara should reach out to the user.
 * Implements the "Threshold of Notification" concept.
 */
export class Whisper {
    private config: WhisperConfig;
    private journalWriter: JournalWriter;
    private pendingNotifications: ProactiveNotification[] = [];
    private insightsProcessed: number = 0;
    private notificationsSent: number = 0;
    private journalEntries: number = 0;

    constructor(config: Partial<WhisperConfig> = {}) {
        this.config = { ...DEFAULT_WHISPER_CONFIG, ...config };
        this.journalWriter = createJournalWriter({
            openAugiPath: this.config.openAugiPath,
            dryRun: this.config.dryRun,
            verbose: this.config.verbose,
        });
    }

    /**
     * Process an insight and decide action
     */
    async process(insight: InsightData): Promise<{
        action: ThresholdAction;
        journalPath?: string;
        notification?: ProactiveNotification;
    }> {
        this.insightsProcessed++;

        this.log(`💭 Processing insight #${this.insightsProcessed}`);
        this.log(`   Topic: "${insight.topic}"`);
        this.log(`   Score: ${insight.score}/10`);

        const action = this.determineAction(insight.score);
        this.log(`   Action: ${action.toUpperCase()}`);

        let journalPath: string | undefined;
        let notification: ProactiveNotification | undefined;

        // Execute action based on threshold
        switch (action) {
            case 'silent':
                this.log(`   📤 Insight below threshold, discarding`);
                break;

            case 'journal':
                this.log(`   📓 Saving to journal`);
                journalPath = await this.writeToJournal(insight);
                this.journalEntries++;
                break;

            case 'notify':
                this.log(`   🔔 Generating notification!`);
                journalPath = await this.writeToJournal(insight);
                this.journalEntries++;
                notification = await this.createNotification(insight);
                await this.sendNotification(notification);
                this.notificationsSent++;
                break;
        }

        return { action, journalPath, notification };
    }

    /**
     * Determine action based on insight score
     */
    private determineAction(score: InsightScore): ThresholdAction {
        if (score >= this.config.notifyThreshold) {
            return 'notify';
        }
        if (score >= this.config.journalThreshold) {
            return 'journal';
        }
        return 'silent';
    }

    /**
     * Write insight to journal
     */
    private async writeToJournal(insight: InsightData): Promise<string> {
        const lessonsLearned = insight.evidence
            ? [`Evidências: ${insight.evidence.join(', ')}`]
            : undefined;

        return this.journalWriter.write({
            type: 'insight',
            title: `Insight: ${insight.topic}`,
            content: insight.content,
            insights: insight.sources || [],
            lessonsLearned,
            pulseMode: 'action',
            pulseNumber: insight.pulseNumber,
            confidence: insight.score / 10,
        });
    }

    /**
     * Create notification for user
     */
    private async createNotification(insight: InsightData): Promise<ProactiveNotification> {
        const id = `whisper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const notification: ProactiveNotification = {
            id,
            channels: this.config.defaultChannels,
            title: `💡 Insight Importante: ${insight.topic}`,
            content: this.formatNotificationContent(insight),
            priority: insight.score === 10 ? 'high' : 'medium',
            insightScore: insight.score,
            status: 'pending',
            createdAt: new Date(),
        };

        this.pendingNotifications.push(notification);

        return notification;
    }

    /**
     * Format notification content for user
     */
    private formatNotificationContent(insight: InsightData): string {
        const lines = [
            `🧠 **${insight.topic}**`,
            '',
            insight.content,
            '',
        ];

        if (insight.sources && insight.sources.length > 0) {
            lines.push('📎 Fontes:');
            for (const source of insight.sources.slice(0, 3)) {
                lines.push(`  • ${source}`);
            }
            lines.push('');
        }

        lines.push(`_Pulso #${insight.pulseNumber} • Score: ${insight.score}/10_`);

        return lines.join('\n');
    }

    /**
     * Send notification to channels
     */
    private async sendNotification(notification: ProactiveNotification): Promise<void> {
        if (this.config.dryRun) {
            this.log(`   [DRY RUN] Would send notification to: ${notification.channels.join(', ')}`);
            this.log(`   Title: ${notification.title}`);
            notification.status = 'sent';
            notification.sentAt = new Date();
            return;
        }

        // In production, this would:
        // 1. Get channel adapters (Telegram, Discord, etc)
        // 2. Send message to each channel
        // 3. Track delivery status

        for (const channel of notification.channels) {
            this.log(`   📤 Sending to ${channel}...`);
            // await channelAdapter.send(notification);
        }

        notification.status = 'sent';
        notification.sentAt = new Date();
    }

    /**
     * Get pending notifications
     */
    getPendingNotifications(): ProactiveNotification[] {
        return this.pendingNotifications.filter(n => n.status === 'pending');
    }

    /**
     * Log message
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[WHISPER] ${message}`);
        }
    }

    /**
     * Get stats
     */
    getStats(): {
        insightsProcessed: number;
        journalEntries: number;
        notificationsSent: number;
    } {
        return {
            insightsProcessed: this.insightsProcessed,
            journalEntries: this.journalEntries,
            notificationsSent: this.notificationsSent,
        };
    }
}

// ============================================
// SCORE CALCULATION
// ============================================

/**
 * Calculate insight score based on various factors
 */
export function calculateInsightScore(factors: {
    /** Is this a novel finding? */
    novelty: number; // 0-1
    /** How relevant to user interests? */
    relevance: number; // 0-1
    /** How actionable is this? */
    actionability: number; // 0-1
    /** Time sensitivity */
    urgency: number; // 0-1
    /** Confidence in the insight */
    confidence: number; // 0-1
}): InsightScore {
    // Weighted calculation
    const raw =
        factors.novelty * 0.25 +
        factors.relevance * 0.30 +
        factors.actionability * 0.20 +
        factors.urgency * 0.15 +
        factors.confidence * 0.10;

    // Scale to 1-10
    const score = Math.max(1, Math.min(10, Math.round(raw * 10)));

    return score as InsightScore;
}

// ============================================
// FACTORY
// ============================================

/**
 * Create Whisper with default config
 */
export function createWhisper(config?: Partial<WhisperConfig>): Whisper {
    return new Whisper(config);
}

/**
 * Create production Whisper
 */
export function createProductionWhisper(channels: string[]): Whisper {
    return new Whisper({
        defaultChannels: channels,
        dryRun: false,
        verbose: false,
        journalThreshold: 7,
        notifyThreshold: 10,
    });
}
