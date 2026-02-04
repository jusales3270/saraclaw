/**
 * Sara Heart Module - Insights Detector
 * 
 * Logic to detect and score insight value for proactive actions.
 */

import { InsightData } from './pulse-states.js';

/**
 * Signal types that can be analyzed for insights
 */
export type SignalType =
    | 'message'
    | 'calendar_event'
    | 'reminder'
    | 'pattern_break'
    | 'deadline_approaching'
    | 'recurring_topic'
    | 'sentiment_shift';

/**
 * Raw signal data for analysis
 */
export interface RawSignal {
    type: SignalType;
    timestamp: Date;
    content: string;
    metadata?: Record<string, unknown>;
}

/**
 * Pattern detection result
 */
export interface PatternMatch {
    pattern: string;
    confidence: number;
    signals: RawSignal[];
    recommendation: string;
}

/**
 * Insights Detector
 * 
 * Analyzes signals and context to detect high-value insights.
 */
export class InsightsDetector {
    private signalBuffer: RawSignal[] = [];
    private maxBufferSize: number;

    constructor(maxBufferSize: number = 100) {
        this.maxBufferSize = maxBufferSize;
    }

    /**
     * Add a signal to the buffer for analysis
     */
    addSignal(signal: RawSignal): void {
        this.signalBuffer.push(signal);

        // Trim buffer if needed
        if (this.signalBuffer.length > this.maxBufferSize) {
            this.signalBuffer = this.signalBuffer.slice(-this.maxBufferSize);
        }
    }

    /**
     * Get recent signals of a specific type
     */
    getSignalsByType(type: SignalType, limit?: number): RawSignal[] {
        const filtered = this.signalBuffer.filter(s => s.type === type);
        return limit ? filtered.slice(-limit) : filtered;
    }

    /**
     * Analyze signals and detect insights
     */
    detectInsights(openAugiContext?: string): InsightData[] {
        const insights: InsightData[] = [];

        // Check for deadline approaching
        const deadlineInsight = this.detectDeadlineApproaching();
        if (deadlineInsight) {
            insights.push(deadlineInsight);
        }

        // Check for recurring topics
        const topicInsight = this.detectRecurringTopics();
        if (topicInsight) {
            insights.push(topicInsight);
        }

        // Check for pattern breaks
        const patternInsight = this.detectPatternBreaks();
        if (patternInsight) {
            insights.push(patternInsight);
        }

        // Enrich with OpenAugi context if available
        if (openAugiContext) {
            const contextInsight = this.enrichWithContext(openAugiContext);
            if (contextInsight) {
                insights.push(contextInsight);
            }
        }

        // Sort by value score
        return insights.sort((a, b) => b.valueScore - a.valueScore);
    }

    /**
     * Detect approaching deadlines
     */
    private detectDeadlineApproaching(): InsightData | null {
        const calendarSignals = this.getSignalsByType('calendar_event');
        const reminderSignals = this.getSignalsByType('reminder');

        const now = new Date();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // Find events within 24 hours
        const upcomingEvents = [...calendarSignals, ...reminderSignals].filter(signal => {
            const eventTime = signal.metadata?.eventTime as Date | undefined;
            if (!eventTime) return false;

            const timeDiff = eventTime.getTime() - now.getTime();
            return timeDiff > 0 && timeDiff <= twentyFourHours;
        });

        if (upcomingEvents.length === 0) {
            return null;
        }

        // Calculate urgency based on time remaining
        const mostUrgent = upcomingEvents.reduce((prev, curr) => {
            const prevTime = (prev.metadata?.eventTime as Date)?.getTime() ?? Infinity;
            const currTime = (curr.metadata?.eventTime as Date)?.getTime() ?? Infinity;
            return currTime < prevTime ? curr : prev;
        });

        const timeUntil = (mostUrgent.metadata?.eventTime as Date).getTime() - now.getTime();
        const urgencyScore = Math.max(0, 1 - (timeUntil / twentyFourHours));

        return {
            source: 'calendar',
            description: `Evento próximo: ${mostUrgent.content}`,
            valueScore: 0.7,
            urgencyScore,
            suggestedAction: urgencyScore > 0.8 ? 'notify' : 'defer',
            context: {
                eventCount: upcomingEvents.length,
                mostUrgentEvent: mostUrgent.content,
                hoursUntil: Math.round(timeUntil / (60 * 60 * 1000)),
            },
        };
    }

    /**
     * Detect recurring topics in recent messages
     */
    private detectRecurringTopics(): InsightData | null {
        const messages = this.getSignalsByType('message', 20);

        if (messages.length < 5) {
            return null;
        }

        // Simple word frequency analysis
        const wordCounts = new Map<string, number>();
        const stopWords = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'que', 'em', 'para', 'um', 'uma', 'the', 'is', 'are', 'to', 'and']);

        for (const msg of messages) {
            const words = msg.content.toLowerCase().split(/\s+/);
            for (const word of words) {
                if (word.length < 3 || stopWords.has(word)) continue;
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            }
        }

        // Find words that appear in more than 30% of messages
        const threshold = messages.length * 0.3;
        const recurringWords = Array.from(wordCounts.entries())
            .filter(([_, count]) => count >= threshold)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (recurringWords.length === 0) {
            return null;
        }

        const topTopic = recurringWords[0][0];
        const occurrence = recurringWords[0][1];

        return {
            source: 'pattern_match',
            description: `Tópico recorrente detectado: "${topTopic}" (${occurrence} menções)`,
            valueScore: Math.min(0.8, occurrence / messages.length),
            urgencyScore: 0.3,
            suggestedAction: 'defer',
            context: {
                recurringTopics: recurringWords.map(([word, count]) => ({ word, count })),
            },
        };
    }

    /**
     * Detect pattern breaks (unusual activity or silence)
     */
    private detectPatternBreaks(): InsightData | null {
        const allSignals = this.signalBuffer;

        if (allSignals.length < 10) {
            return null;
        }

        // Calculate average interval between signals
        let totalInterval = 0;
        for (let i = 1; i < allSignals.length; i++) {
            totalInterval += allSignals[i].timestamp.getTime() - allSignals[i - 1].timestamp.getTime();
        }
        const avgInterval = totalInterval / (allSignals.length - 1);

        // Check if last signal was unusually long ago
        const lastSignal = allSignals[allSignals.length - 1];
        const timeSinceLastSignal = Date.now() - lastSignal.timestamp.getTime();

        if (timeSinceLastSignal > avgInterval * 3) {
            return {
                source: 'pattern_match',
                description: 'Padrão de atividade quebrado: período incomum de silêncio detectado',
                valueScore: 0.5,
                urgencyScore: 0.4,
                suggestedAction: 'defer',
                context: {
                    avgIntervalMs: avgInterval,
                    timeSinceLastMs: timeSinceLastSignal,
                    silenceMultiplier: timeSinceLastSignal / avgInterval,
                },
            };
        }

        return null;
    }

    /**
     * Enrich insights with OpenAugi context
     */
    private enrichWithContext(openAugiContext: string): InsightData | null {
        // Look for keywords that suggest important historical context
        const keywords = ['importante', 'urgente', 'deadline', 'reunião', 'meeting', 'lembrar', 'remember'];

        const lowercaseContext = openAugiContext.toLowerCase();
        const matchedKeywords = keywords.filter(kw => lowercaseContext.includes(kw));

        if (matchedKeywords.length === 0) {
            return null;
        }

        return {
            source: 'openaugi',
            description: `Contexto histórico relevante detectado (${matchedKeywords.join(', ')})`,
            valueScore: Math.min(0.9, 0.5 + matchedKeywords.length * 0.1),
            urgencyScore: 0.5,
            suggestedAction: 'notify',
            context: {
                matchedKeywords,
                contextLength: openAugiContext.length,
            },
        };
    }

    /**
     * Clear the signal buffer
     */
    clearBuffer(): void {
        this.signalBuffer = [];
    }

    /**
     * Get buffer size
     */
    getBufferSize(): number {
        return this.signalBuffer.length;
    }
}

/**
 * Create a new insights detector
 */
export function createInsightsDetector(maxBufferSize?: number): InsightsDetector {
    return new InsightsDetector(maxBufferSize);
}

/**
 * Score an insight for action priority
 */
export function scoreInsight(insight: InsightData): number {
    // Combined score: 70% value, 30% urgency
    return insight.valueScore * 0.7 + insight.urgencyScore * 0.3;
}

/**
 * Get the highest priority insight from a list
 */
export function getTopInsight(insights: InsightData[]): InsightData | null {
    if (insights.length === 0) {
        return null;
    }

    return insights.reduce((best, current) => {
        return scoreInsight(current) > scoreInsight(best) ? current : best;
    });
}
