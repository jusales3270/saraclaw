/**
 * Sara Reflexion Module - Inner Monologue
 * 
 * Core logic for generating "hidden thoughts" before each response.
 * Provides auditable decision-making through documented reasoning chains.
 */

import { ThoughtLog, ThoughtEntry, createThoughtLog } from './thought-log.js';

/**
 * Trigger types that can initiate a reflexion cycle
 */
export type ReflexionTrigger =
    | 'heartbeat_cycle'
    | 'user_message'
    | 'proactive_check'
    | 'security_alert'
    | 'context_update';

/**
 * Decision types that can result from reflexion
 */
export type ReflexionDecision =
    | 'respond'
    | 'proactive_notification'
    | 'execute_tool'
    | 'defer'
    | 'escalate'
    | 'suppress';

/**
 * Risk assessment levels
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Result of an inner monologue reflexion cycle
 */
export interface ReflexionResult {
    /** Unique identifier for this reflexion */
    id: string;

    /** Timestamp of the reflexion */
    timestamp: Date;

    /** What triggered this reflexion */
    trigger: ReflexionTrigger;

    /** Data analyzed during reflexion */
    dataAnalyzed: string[];

    /** The reasoning chain (hidden thought) */
    reasoning: string;

    /** Final decision */
    decision: ReflexionDecision;

    /** Justification for the decision */
    justification: string;

    /** Risk assessment */
    riskLevel: RiskLevel;

    /** Confidence score (0-1) */
    confidence: number;

    /** Optional context from OpenAugi */
    openAugiContext?: string;
}

/**
 * Inner Monologue engine for auditable decision-making
 */
export class InnerMonologue {
    private thoughtLog: ThoughtLog;
    private sessionId: string;

    constructor(sessionId: string, logPath?: string) {
        this.sessionId = sessionId;
        this.thoughtLog = createThoughtLog(logPath);
    }

    /**
     * Generate a unique reflexion ID
     */
    private generateReflexionId(): string {
        const now = new Date();
        const dateStr = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const random = Math.random().toString(36).substring(2, 6);
        return `REF-${dateStr}-${random}`;
    }

    /**
     * Perform an inner monologue reflexion cycle
     */
    async reflect(params: {
        trigger: ReflexionTrigger;
        inputData: string[];
        openAugiContext?: string;
        currentState?: 'idle' | 'reflexion' | 'action';
    }): Promise<ReflexionResult> {
        const reflexionId = this.generateReflexionId();
        const timestamp = new Date();

        // Build the reasoning chain based on inputs
        const reasoning = this.buildReasoningChain(params);

        // Evaluate the decision
        const evaluation = this.evaluateDecision(params, reasoning);

        const result: ReflexionResult = {
            id: reflexionId,
            timestamp,
            trigger: params.trigger,
            dataAnalyzed: params.inputData,
            reasoning,
            decision: evaluation.decision,
            justification: evaluation.justification,
            riskLevel: evaluation.riskLevel,
            confidence: evaluation.confidence,
            openAugiContext: params.openAugiContext,
        };

        // Log the reflexion for audit
        await this.logReflexion(result);

        return result;
    }

    /**
     * Build a reasoning chain from the input data
     */
    private buildReasoningChain(params: {
        trigger: ReflexionTrigger;
        inputData: string[];
        openAugiContext?: string;
    }): string {
        const lines: string[] = [];

        lines.push(`## Análise do Trigger: ${params.trigger}`);
        lines.push('');
        lines.push('### Dados de Entrada:');
        params.inputData.forEach((data, i) => {
            lines.push(`${i + 1}. ${data}`);
        });

        if (params.openAugiContext) {
            lines.push('');
            lines.push('### Contexto Histórico (OpenAugi):');
            lines.push(params.openAugiContext);
        }

        lines.push('');
        lines.push('### Raciocínio:');
        lines.push('Analisando os dados disponíveis para determinar a melhor ação...');

        return lines.join('\n');
    }

    /**
     * Evaluate and decide on the appropriate action
     */
    private evaluateDecision(
        params: {
            trigger: ReflexionTrigger;
            inputData: string[];
            openAugiContext?: string;
        },
        reasoning: string
    ): {
        decision: ReflexionDecision;
        justification: string;
        riskLevel: RiskLevel;
        confidence: number;
    } {
        // Default conservative evaluation
        let decision: ReflexionDecision = 'defer';
        let justification = 'Aguardando mais informações para decidir.';
        let riskLevel: RiskLevel = 'low';
        let confidence = 0.5;

        // Evaluate based on trigger type
        switch (params.trigger) {
            case 'user_message':
                decision = 'respond';
                justification = 'Mensagem do usuário requer resposta direta.';
                confidence = 0.9;
                break;

            case 'heartbeat_cycle':
                // Check if there's high-value insight from OpenAugi
                if (params.openAugiContext && params.openAugiContext.length > 100) {
                    decision = 'proactive_notification';
                    justification = 'Contexto histórico sugere insight de alto valor.';
                    confidence = 0.7;
                } else {
                    decision = 'defer';
                    justification = 'Nenhum insight de alto valor detectado neste ciclo.';
                    confidence = 0.8;
                }
                break;

            case 'security_alert':
                decision = 'escalate';
                justification = 'Alerta de segurança requer atenção imediata.';
                riskLevel = 'high';
                confidence = 0.95;
                break;

            case 'proactive_check':
                decision = 'defer';
                justification = 'Verificação proativa não identificou necessidade de ação.';
                confidence = 0.6;
                break;

            case 'context_update':
                decision = 'suppress';
                justification = 'Atualização de contexto processada silenciosamente.';
                confidence = 0.85;
                break;
        }

        return { decision, justification, riskLevel, confidence };
    }

    /**
     * Log the reflexion result for audit purposes
     */
    private async logReflexion(result: ReflexionResult): Promise<void> {
        const entry: ThoughtEntry = {
            id: result.id,
            sessionId: this.sessionId,
            timestamp: result.timestamp,
            trigger: result.trigger,
            reasoning: result.reasoning,
            decision: result.decision,
            justification: result.justification,
            riskLevel: result.riskLevel,
            confidence: result.confidence,
        };

        await this.thoughtLog.append(entry);
    }

    /**
     * Retrieve recent reflexions for a session
     */
    async getRecentReflexions(limit: number = 10): Promise<ThoughtEntry[]> {
        return this.thoughtLog.getRecent(this.sessionId, limit);
    }

    /**
     * Format a reflexion result as a markdown block (for internal logging)
     */
    formatAsMarkdown(result: ReflexionResult): string {
        return `## Reflexão ${result.id}

**Trigger**: ${result.trigger}
**Timestamp**: ${result.timestamp.toISOString()}
**Dados Analisados**: 
${result.dataAnalyzed.map(d => `- ${d}`).join('\n')}

**Raciocínio**:
${result.reasoning}

**Decisão**: ${result.decision.toUpperCase()}
**Justificativa**: ${result.justification}
**Risco**: ${result.riskLevel}
**Confiança**: ${(result.confidence * 100).toFixed(0)}%
`;
    }
}

/**
 * Create a new InnerMonologue instance for a session
 */
export function createInnerMonologue(sessionId: string, logPath?: string): InnerMonologue {
    return new InnerMonologue(sessionId, logPath);
}
