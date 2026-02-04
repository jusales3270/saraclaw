/**
 * Sara Heart - Curiosity Engine
 * 
 * Decides when Sara should actively seek new information via browser.
 * Prevents "spam bot" behavior by applying intelligent relevance criteria.
 * 
 * Key Principle: Sara only researches when there's a "knowledge gap"
 * between what she knows (OpenAugi) and what's happening (world).
 */

// ============================================
// TYPES
// ============================================

/**
 * Context from OpenAugi notes
 */
export interface KnowledgeContext {
    /** Topics found in notes */
    topics: string[];

    /** Key assertions/claims made */
    assertions: string[];

    /** Dates of last updates */
    lastUpdated: Date[];

    /** Overall freshness score (0-1) */
    freshnessScore: number;

    /** Number of notes analyzed */
    noteCount: number;
}

/**
 * Knowledge gap analysis result
 */
export interface KnowledgeGap {
    /** Topic with potential gap */
    topic: string;

    /** Why there's a gap */
    reason: 'outdated' | 'incomplete' | 'contradictory' | 'trending';

    /** Confidence that research is needed (0-1) */
    confidence: number;

    /** Suggested search queries */
    suggestedQueries: string[];
}

/**
 * Curiosity decision result
 */
export interface CuriosityDecision {
    /** Should Sara research? */
    shouldResearch: boolean;

    /** Why or why not */
    reason: string;

    /** If researching, what topic? */
    topic?: string;

    /** Search queries to use */
    queries: string[];

    /** Relevance score (0-100) */
    relevanceScore: number;

    /** Energy cost estimate (tokens) */
    estimatedTokenCost: number;

    /** Alternative: stay idle */
    idleReason?: string;
}

/**
 * Curiosity Engine configuration
 */
export interface CuriosityConfig {
    /** Minimum context diff to trigger research (0-1) */
    contextDiffThreshold: number;

    /** Maximum note age before considered stale (days) */
    maxNoteAgeDays: number;

    /** Minimum notes needed for analysis */
    minNotesForAnalysis: number;

    /** Maximum queries per heartbeat */
    maxQueriesPerHeartbeat: number;

    /** Token budget per research cycle */
    tokenBudget: number;

    /** Enable verbose logging */
    verbose: boolean;
}

/** Default configuration */
export const DEFAULT_CURIOSITY_CONFIG: CuriosityConfig = {
    contextDiffThreshold: 0.4, // 40% - as suggested
    maxNoteAgeDays: 30,
    minNotesForAnalysis: 2,
    maxQueriesPerHeartbeat: 3,
    tokenBudget: 1000,
    verbose: false,
};

// ============================================
// CURIOSITY ENGINE
// ============================================

/**
 * Curiosity Engine
 * 
 * Analyzes Sara's knowledge and decides if research is warranted.
 */
export class CuriosityEngine {
    private config: CuriosityConfig;
    private lastDecision: CuriosityDecision | null = null;
    private consecutiveIdleCycles: number = 0;

    constructor(config: Partial<CuriosityConfig> = {}) {
        this.config = { ...DEFAULT_CURIOSITY_CONFIG, ...config };
    }

    /**
     * Main decision function: Should Sara research?
     */
    decide(knowledge: KnowledgeContext): CuriosityDecision {
        this.log('Analyzing knowledge context...');

        // Check minimum notes
        if (knowledge.noteCount < this.config.minNotesForAnalysis) {
            return this.idleDecision(
                'Conhecimento base insuficiente para análise',
                10
            );
        }

        // Analyze knowledge gaps
        const gaps = this.findKnowledgeGaps(knowledge);

        if (gaps.length === 0) {
            this.consecutiveIdleCycles++;
            return this.idleDecision(
                'Nenhuma lacuna de conhecimento detectada',
                20
            );
        }

        // Find most relevant gap
        const primaryGap = gaps.sort((a, b) => b.confidence - a.confidence)[0];

        // Calculate context difference
        const contextDiff = this.calculateContextDiff(knowledge, primaryGap);

        this.log(`Context diff: ${(contextDiff * 100).toFixed(1)}%`);
        this.log(`Threshold: ${(this.config.contextDiffThreshold * 100).toFixed(1)}%`);

        // Decision: research if diff exceeds threshold
        if (contextDiff >= this.config.contextDiffThreshold) {
            this.consecutiveIdleCycles = 0;

            const decision: CuriosityDecision = {
                shouldResearch: true,
                reason: this.formatGapReason(primaryGap),
                topic: primaryGap.topic,
                queries: primaryGap.suggestedQueries.slice(0, this.config.maxQueriesPerHeartbeat),
                relevanceScore: Math.round(contextDiff * 100),
                estimatedTokenCost: this.estimateTokenCost(primaryGap.suggestedQueries.length),
            };

            this.lastDecision = decision;
            return decision;
        }

        // Below threshold - stay idle
        this.consecutiveIdleCycles++;

        return this.idleDecision(
            `Diferença de contexto (${(contextDiff * 100).toFixed(1)}%) abaixo do limiar`,
            Math.round(contextDiff * 100)
        );
    }

    /**
     * Find gaps in knowledge that warrant research
     */
    private findKnowledgeGaps(knowledge: KnowledgeContext): KnowledgeGap[] {
        const gaps: KnowledgeGap[] = [];
        const now = new Date();

        for (let i = 0; i < knowledge.topics.length; i++) {
            const topic = knowledge.topics[i];
            const assertion = knowledge.assertions[i] || '';
            const lastUpdated = knowledge.lastUpdated[i] || new Date(0);

            // Check age
            const ageInDays = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

            if (ageInDays > this.config.maxNoteAgeDays) {
                gaps.push({
                    topic,
                    reason: 'outdated',
                    confidence: Math.min(0.9, ageInDays / 100),
                    suggestedQueries: [
                        `${topic} últimas notícias`,
                        `${topic} novidades ${now.getFullYear()}`,
                    ],
                });
            }

            // Check for trending topics (simplified heuristic)
            if (this.isTrendingTopic(topic)) {
                gaps.push({
                    topic,
                    reason: 'trending',
                    confidence: 0.7,
                    suggestedQueries: [
                        `${topic} hoje`,
                        `${topic} breaking news`,
                    ],
                });
            }

            // Check for incomplete knowledge
            if (assertion.includes('?') || assertion.includes('talvez') || assertion.includes('incerto')) {
                gaps.push({
                    topic,
                    reason: 'incomplete',
                    confidence: 0.6,
                    suggestedQueries: [
                        `${topic} explicação`,
                        `${topic} guia completo`,
                    ],
                });
            }
        }

        return gaps;
    }

    /**
     * Calculate context difference score
     */
    private calculateContextDiff(knowledge: KnowledgeContext, gap: KnowledgeGap): number {
        // Factors that increase diff score:
        // 1. Note staleness (inverse of freshness)
        // 2. Gap confidence
        // 3. Consecutive idle cycles (curiosity builds up)

        const stalenessFactor = 1 - knowledge.freshnessScore;
        const gapFactor = gap.confidence;
        const idleFactor = Math.min(0.3, this.consecutiveIdleCycles * 0.05);

        // Weighted combination
        const diff = (stalenessFactor * 0.4) + (gapFactor * 0.5) + (idleFactor * 0.1);

        return Math.min(1, Math.max(0, diff));
    }

    /**
     * Check if topic is trending (simplified)
     */
    private isTrendingTopic(topic: string): boolean {
        // In production, this would query a trends API
        const trendingKeywords = [
            'IA', 'AI', 'GPT', 'LLM',
            'soberania', 'privacidade',
            'cibersegurança', 'vazamento',
            'regulação', 'LGPD', 'GDPR',
        ];

        return trendingKeywords.some(kw =>
            topic.toLowerCase().includes(kw.toLowerCase())
        );
    }

    /**
     * Format gap reason for output
     */
    private formatGapReason(gap: KnowledgeGap): string {
        switch (gap.reason) {
            case 'outdated':
                return `Conhecimento sobre "${gap.topic}" está desatualizado`;
            case 'incomplete':
                return `Existem dúvidas não resolvidas sobre "${gap.topic}"`;
            case 'contradictory':
                return `Informações contraditórias detectadas sobre "${gap.topic}"`;
            case 'trending':
                return `"${gap.topic}" é um tópico em destaque que merece atenção`;
            default:
                return `Lacuna detectada em "${gap.topic}"`;
        }
    }

    /**
     * Estimate token cost for research
     */
    private estimateTokenCost(queryCount: number): number {
        // Rough estimate: 200 tokens per query (search + extract + analyze)
        return queryCount * 200;
    }

    /**
     * Create idle decision
     */
    private idleDecision(reason: string, relevanceScore: number): CuriosityDecision {
        return {
            shouldResearch: false,
            reason: 'Permanecendo em modo econômico',
            queries: [],
            relevanceScore,
            estimatedTokenCost: 0,
            idleReason: reason,
        };
    }

    /**
     * Log message if verbose
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[CURIOSITY] ${message}`);
        }
    }

    /**
     * Get last decision
     */
    getLastDecision(): CuriosityDecision | null {
        return this.lastDecision;
    }

    /**
     * Get idle cycle count
     */
    getIdleCycles(): number {
        return this.consecutiveIdleCycles;
    }

    /**
     * Reset state
     */
    reset(): void {
        this.lastDecision = null;
        this.consecutiveIdleCycles = 0;
    }

    /**
     * Get configuration summary
     */
    getSummary(): string {
        return [
            'CuriosityEngine Configuration:',
            `  Threshold: ${(this.config.contextDiffThreshold * 100)}%`,
            `  Max Note Age: ${this.config.maxNoteAgeDays} days`,
            `  Token Budget: ${this.config.tokenBudget}`,
            `  Consecutive Idle: ${this.consecutiveIdleCycles}`,
        ].join('\n');
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create CuriosityEngine with default config
 */
export function createCuriosityEngine(config?: Partial<CuriosityConfig>): CuriosityEngine {
    return new CuriosityEngine(config);
}

/**
 * Create conservative engine (higher threshold)
 */
export function createConservativeCuriosityEngine(): CuriosityEngine {
    return new CuriosityEngine({
        contextDiffThreshold: 0.6, // 60% - more conservative
        tokenBudget: 500,
    });
}

/**
 * Create curious engine (lower threshold)
 */
export function createCuriousCuriosityEngine(): CuriosityEngine {
    return new CuriosityEngine({
        contextDiffThreshold: 0.25, // 25% - more active
        tokenBudget: 2000,
    });
}

// ============================================
// HELPERS
// ============================================

/**
 * Build KnowledgeContext from markdown notes
 */
export function buildKnowledgeContext(notes: Array<{
    title: string;
    content: string;
    modifiedAt: Date;
}>): KnowledgeContext {
    const topics: string[] = [];
    const assertions: string[] = [];
    const lastUpdated: Date[] = [];

    const now = new Date();
    let totalAgeDays = 0;

    for (const note of notes) {
        topics.push(note.title);

        // Extract first sentence as assertion
        const firstSentence = note.content.split(/[.!?]/)[0] || '';
        assertions.push(firstSentence.trim());

        lastUpdated.push(note.modifiedAt);

        const ageInDays = (now.getTime() - note.modifiedAt.getTime()) / (1000 * 60 * 60 * 24);
        totalAgeDays += ageInDays;
    }

    // Calculate freshness (newer = higher score)
    const avgAgeDays = notes.length > 0 ? totalAgeDays / notes.length : 365;
    const freshnessScore = Math.max(0, 1 - (avgAgeDays / 365));

    return {
        topics,
        assertions,
        lastUpdated,
        freshnessScore,
        noteCount: notes.length,
    };
}
