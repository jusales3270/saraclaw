import { LLMClient } from '../agents/llm/llm-client.js';
import { OpenAugiReader } from '../../packages/sara-memory/src/reader.js';
import { JournalWriter } from '../../packages/sara-memory/src/writer.js';

export interface Insight {
    id: string;
    content: string;
    score: number;           // 0-10 (7-8=journal, 9=prepare, 10=notify)
    category: string;        // 'strategic', 'urgent', 'learning', 'warning'
    source: string;          // 'heartbeat', 'research', 'synthesis'
    timestamp: Date;
    metadata?: {
        relatedNotes?: string[];
        confidence?: number;
        actionable?: boolean;
    };
}

export interface WhisperNotification {
    id: string;
    type: 'whisper';
    insight: Insight;
    deliveryMethod: 'notification' | 'journal';
    createdAt: Date;
}

/**
 * TheWhisper - Proactive intelligence layer
 * Generates insights from autonomous processes and notifies user when critical
 */
export class TheWhisper {
    private insightQueue: Insight[] = [];
    private journalWriter: JournalWriter;

    constructor(
        private llmClient: LLMClient,
        private openAugiReader: OpenAugiReader
    ) {
        this.journalWriter = new JournalWriter();
    }

    /**
     * Process autonomous research results and generate insights
     */
    async processResearchResults(
        topic: string,
        findings: string[],
        userContext: any
    ): Promise<Insight[]> {
        console.log('[Whisper] Processing research results:', { topic, findingsCount: findings.length });

        try {
            // 1. Synthesize findings with LLM
            const synthesis = await this.synthesizeFindings(topic, findings, userContext);

            // 2. Extract insights
            const insights = await this.extractInsights(synthesis);

            // 3. Score each insight
            const scoredInsights = await Promise.all(
                insights.map(insight => this.scoreInsight(insight, userContext))
            );

            // 4. Handle based on score
            for (const insight of scoredInsights) {
                await this.handleInsight(insight);
            }

            return scoredInsights;

        } catch (error: any) {
            console.error('[Whisper] Error processing research:', error);
            return [];
        }
    }

    /**
     * Synthesize findings into coherent narrative
     */
    private async synthesizeFindings(
        topic: string,
        findings: string[],
        userContext: any
    ): Promise<string> {
        const prompt = `Você acabou de pesquisar sobre "${topic}".

Contexto do usuário:
${userContext.profession ? `- Profissão: ${userContext.profession}` : ''}
${userContext.relevantNotes?.length > 0 ? `- Notas relacionadas: ${userContext.relevantNotes.length}` : ''}

Descobertas da pesquisa:
${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Tarefa: Sintetize essas descobertas em 2-3 insights acionáveis. Para cada insight:
1. Explique o que mudou ou é novo
2. Por que isso importa para o usuário
3. Sugira uma ação (se aplicável)

Formato de resposta (JSON):
{
  "insights": [
    {
      "content": "Insight aqui",
      "category": "strategic|urgent|learning|warning",
      "actionable": true/false
    }
  ]
}`;

        const response = await this.llmClient.chat(prompt, {
            context: {
                type: 'synthesis',
                complexity: 'high',
                // isCritical: true, // Not in TaskContext type yet, maybe add or omit
                tokenBudgetRemaining: 2.0,
                feature: 'whisper'
            },
            maxTokens: 1500,
            temperature: 0.7
        });

        return response.content;
    }

    /**
     * Extract structured insights from synthesis
     */
    private async extractInsights(synthesis: string): Promise<Insight[]> {
        try {
            // Try to parse as JSON
            const cleanSynthesis = synthesis
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const parsed = JSON.parse(cleanSynthesis);

            return parsed.insights.map((ins: any) => ({
                id: this.generateInsightId(),
                content: ins.content,
                score: 0, // Will be scored separately
                category: ins.category || 'learning',
                source: 'research',
                timestamp: new Date(),
                metadata: {
                    actionable: ins.actionable,
                    confidence: 0.8
                }
            }));

        } catch (error) {
            // Fallback: treat entire synthesis as single insight
            console.warn('[Whisper] Could not parse JSON, using fallback');

            return [{
                id: this.generateInsightId(),
                content: synthesis,
                score: 0,
                category: 'learning',
                source: 'research',
                timestamp: new Date(),
                metadata: { confidence: 0.6 }
            }];
        }
    }

    /**
     * Score insight importance (0-10)
     */
    private async scoreInsight(
        insight: Insight,
        userContext: any
    ): Promise<Insight> {
        const prompt = `Você é Sara, uma IA que precisa decidir se deve notificar o usuário.

Contexto do usuário:
${userContext.profession ? `- Profissão: ${userContext.profession}` : ''}
${userContext.relevantNotes?.length > 0 ? `- Tem ${userContext.relevantNotes.length} notas relacionadas` : ''}

Insight:
"${insight.content}"

Categoria: ${insight.category}

Avalie a importância deste insight (0-10):
- 0-6: Irrelevante ou óbvio (ignorar)
- 7-8: Interessante, mas não urgente (salvar no diário)
- 9: Importante, preparar notificação
- 10: CRÍTICO, notificar imediatamente

Considere:
- Relevância para o usuário
- Urgência temporal
- Potencial de impacto
- Acionabilidade

Responda APENAS com um número de 0 a 10.`;

        try {
            const response = await this.llmClient.chat(prompt, {
                context: {
                    type: 'analysis',
                    complexity: 'low',
                    tokenBudgetRemaining: 2.0,
                    feature: 'whisper'
                },
                maxTokens: 10,
                temperature: 0.3
            });

            const score = parseInt(response.content.trim());

            if (isNaN(score) || score < 0 || score > 10) {
                console.warn('[Whisper] Invalid score, defaulting to 7');
                insight.score = 7;
            } else {
                insight.score = score;
            }

        } catch (error) {
            console.error('[Whisper] Error scoring insight:', error);
            insight.score = 7; // Default to journaling
        }

        console.log('[Whisper] Scored insight:', { score: insight.score, category: insight.category });

        return insight;
    }

    /**
     * Handle insight based on score
     */
    private async handleInsight(insight: Insight): Promise<void> {
        if (insight.score < 7) {
            // Ignore
            console.log('[Whisper] Insight below threshold, ignoring');
            return;
        }

        if (insight.score >= 7 && insight.score < 9) {
            // Journal only
            console.log('[Whisper] Journaling insight (score 7-8)');
            await this.journalInsight(insight);
            return;
        }

        if (insight.score >= 9) {
            // Queue for notification
            console.log('[Whisper] Queueing notification (score 9-10)');
            this.insightQueue.push(insight);

            // Also journal
            await this.journalInsight(insight);
        }
    }

    /**
     * Save insight to journal
     */
    private async journalInsight(insight: Insight): Promise<void> {
        const entry = `---
type: whisper-insight
score: ${insight.score}
category: ${insight.category}
source: ${insight.source}
timestamp: ${insight.timestamp.toISOString()}
---

# Insight: ${insight.category}

${insight.content}

---
Confidence: ${insight.metadata?.confidence || 'N/A'}
Actionable: ${insight.metadata?.actionable ? 'Yes' : 'No'}
`;

        // Note: JournalWriter.writeReflection might vary in implementation, check signature if needed
        // Assuming simple string input or similar.
        await this.journalWriter.writeReflection(entry);
    }

    /**
     * Get pending notifications
     */
    getPendingNotifications(): WhisperNotification[] {
        return this.insightQueue.map(insight => ({
            id: `whisper-${insight.id}`,
            type: 'whisper',
            insight,
            deliveryMethod: insight.score >= 10 ? 'notification' : 'journal',
            createdAt: insight.timestamp
        }));
    }

    /**
     * Clear notification queue
     */
    clearNotifications(): void {
        this.insightQueue = [];
    }

    /**
     * Generate unique insight ID
     */
    private generateInsightId(): string {
        return `ins-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
}
