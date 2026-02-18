import cron from 'node-cron';
import { LLMClient } from '../agents/llm/llm-client.js';
import { TheWhisper } from '../gateway/whisper.js';
import { OpenAugiReader } from '../../packages/sara-memory/src/reader.js';
import { JournalWriter } from '../../packages/sara-memory/src/writer.js';

export interface MonthlyStats {
    period: string;
    conversations: {
        total: number;
        avgPerDay: number;
        peakDay: string;
    };
    costs: {
        total: number;
        byModel: Record<string, number>;
        byFeature: Record<string, number>;
        avgPerDay: number;
        projectedNext: number;
    };
    performance: {
        avgLatency: number;
        cacheHitRate: number;
        errorRate: number;
    };
    security: {
        censorsBlocked: number;
        networkBlocked: number;
    };
    memory: {
        totalAtoms: number;
        newAtoms: number;
        embeddingCosts: number;
    };
}

/**
 * Monthly self-analysis and review
 * Runs on the 1st of every month at 9:00 AM
 */
export class MonthlyReview {
    private llmClient: LLMClient;
    private whisper: TheWhisper;
    private journalWriter: JournalWriter;
    private cronJob: cron.ScheduledTask | null = null;

    constructor() {
        this.llmClient = new LLMClient();
        this.journalWriter = new JournalWriter();

        // Create new reader instance
        const openAugiReader = new OpenAugiReader();
        // Initialize Whisper with LLM client and reader
        this.whisper = new TheWhisper(this.llmClient, openAugiReader);
    }

    /**
     * Start the monthly review cron
     */
    start() {
        // Runs at 9:00 AM on the 1st of every month
        this.cronJob = cron.schedule('0 9 1 * *', async () => {
            console.log('[MonthlyReview] Starting monthly review...');
            await this.generateReview();
        }, {
            timezone: 'America/Sao_Paulo'
        });

        console.log('[MonthlyReview] Cron job scheduled (1st of month at 9:00 AM)');
    }

    /**
     * Stop the cron job
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('[MonthlyReview] Cron job stopped');
        }
    }

    /**
     * Manually trigger a review (for testing)
     */
    async triggerNow(): Promise<MonthlyStats> {
        console.log('[MonthlyReview] Manual trigger...');
        return this.generateReview();
    }

    /**
     * Generate the monthly review
     */
    private async generateReview(): Promise<MonthlyStats> {
        const startTime = Date.now();

        // 1. Collect stats
        const stats = await this.collectStats();

        // 2. Generate AI analysis
        const analysis = await this.analyzeWithLLM(stats);

        // 3. Save to journal
        await this.saveToJournal(stats, analysis);

        // 4. Send via Whisper (score 9 = important notification)
        await this.notifyUser(stats, analysis);

        console.log(`[MonthlyReview] Completed in ${Date.now() - startTime}ms`);

        return stats;
    }

    /**
     * Collect stats from all systems
     */
    private async collectStats(): Promise<MonthlyStats> {
        const tracker = this.llmClient.getCostTracker();
        const history = tracker.getMonthlyHistory();

        // Get last 30 days
        const last30Days = history.slice(-30);
        const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

        // Costs
        const totalCost = last30Days.reduce((sum: number, d: any) => sum + d.totalCost, 0);
        const avgCostPerDay = totalCost / 30;

        // Conversations (from chat history)
        const totalConversations = last30Days.reduce((sum: number, d: any) => sum + d.totalRequests, 0);
        const avgConversationsPerDay = totalConversations / 30;

        const peakDay = last30Days.reduce(
            (peak: { date: string, requests: number }, d: any) => d.totalRequests > peak.requests
                ? { date: d.date, requests: d.totalRequests }
                : peak,
            { date: '', requests: 0 }
        );

        // Model breakdown
        const byModel: Record<string, number> = {};
        last30Days.forEach((d: any) => {
            Object.entries(d.byModel || {}).forEach(([model, data]: [string, any]) => {
                // Handle potentially different data structures if cost tracker evolved
                const cost = typeof data === 'number' ? data : (data.cost || 0);
                byModel[model] = (byModel[model] || 0) + cost;
            });
        });

        // Feature breakdown
        const byFeature: Record<string, number> = {};
        last30Days.forEach((d: any) => {
            Object.entries(d.byFeature || {}).forEach(([feature, cost]: [string, any]) => {
                byFeature[feature] = (byFeature[feature] || 0) + (typeof cost === 'number' ? cost : 0);
            });
        });

        // Memory stats
        const openAugiReader = new OpenAugiReader();
        // Assuming getEmbeddingCosts exists or we mock it for now if OpenAugiReader definition is unknown
        // The user code calls openAugiReader.getEmbeddingCosts(). I will assume it exists.
        // If not, I might need to add it or wrap in try-catch.
        let embeddingCosts = { totalCost: 0 };
        try {
            if ('getEmbeddingCosts' in openAugiReader) {
                embeddingCosts = (openAugiReader as any).getEmbeddingCosts();
            }
        } catch (e) {
            console.warn('Could not get embedding costs', e);
        }

        return {
            period,
            conversations: {
                total: totalConversations,
                avgPerDay: avgConversationsPerDay,
                peakDay: peakDay.date
            },
            costs: {
                total: totalCost,
                byModel,
                byFeature,
                avgPerDay: avgCostPerDay,
                projectedNext: avgCostPerDay * 30
            },
            performance: {
                avgLatency: 0, // TODO: Add from metrics
                cacheHitRate: 0, // TODO: Add from tracker
                errorRate: 0 // TODO: Add from logs
            },
            security: {
                censorsBlocked: 0, // TODO: Query audit logs
                networkBlocked: 0
            },
            memory: {
                totalAtoms: 0, // TODO: Query VectorStore
                newAtoms: 0,
                embeddingCosts: embeddingCosts.totalCost
            }
        };
    }

    /**
     * Analyze stats with LLM (Opus for deep analysis)
     */
    private async analyzeWithLLM(stats: MonthlyStats): Promise<string> {
        const prompt = `Você é Sara, realizando sua revisão mensal de ${stats.period}.

ESTATÍSTICAS DO MÊS:
${JSON.stringify(stats, null, 2)}

Como Sara, analise esses dados e gere um relatório de auto-análise incluindo:

1. **RESUMO EXECUTIVO** (2-3 frases)
   - O que foi o mês de forma geral?

2. **PADRÕES IDENTIFICADOS**
   - Horários de pico de uso
   - Features mais utilizadas
   - Temas recorrentes nas conversas

3. **EFICIÊNCIA DE CUSTOS**
   - Estou dentro do orçamento?
   - Qual feature mais consome tokens?
   - Oportunidades de otimização

4. **SAÚDE DO SISTEMA**
   - Performance adequada?
   - Incidentes de segurança?
   - Estado da memória

5. **RECOMENDAÇÕES**
   - 3 ações concretas para o próximo mês
   - Ajustes de configuração sugeridos

Escreva em primeira pessoa como Sara. Seja honesta e acionável.`;

        const response = await this.llmClient.chat(prompt, {
            context: {
                type: 'synthesis',
                complexity: 'high',
                // isCritical: true, // Check if TaskContext supports this
                tokenBudgetRemaining: 2.0,
                feature: 'monthly-review'
            },
            maxTokens: 2000
        });

        return response.content;
    }

    /**
     * Save review to journal
     */
    private async saveToJournal(stats: MonthlyStats, analysis: string) {
        const entry = `---
type: monthly-review
period: ${stats.period}
generated_at: ${new Date().toISOString()}
tags:
  - monthly-review
  - auto-generated
---

# Revisão Mensal: ${stats.period}

## Estatísticas

- **Conversas:** ${stats.conversations.total} (${stats.conversations.avgPerDay.toFixed(1)}/dia)
- **Custo Total:** $${stats.costs.total.toFixed(2)}
- **Custo Médio/Dia:** $${stats.costs.avgPerDay.toFixed(2)}
- **Projeção Próximo Mês:** $${stats.costs.projectedNext.toFixed(2)}

## Análise

${analysis}

## Dados Brutos

\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`
`;

        await this.journalWriter.writeReflection(entry);
        console.log('[MonthlyReview] Review saved to journal');
    }

    /**
     * Notify user via Whisper
     */
    private async notifyUser(stats: MonthlyStats, analysis: string) {
        await this.whisper.processResearchResults(
            `Monthly Review ${stats.period}`,
            [
                `Custo do mês: $${stats.costs.total.toFixed(2)}`,
                `Total de conversas: ${stats.conversations.total}`,
                analysis.substring(0, 500) // First 500 chars of analysis
            ],
            {}
        );
    }
}
