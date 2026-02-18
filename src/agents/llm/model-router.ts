
import { SARA_MODELS } from './model-config';
import { CostTracker } from './cost-tracker';

export interface TaskContext {
    // Tipo da tarefa
    type:
    | 'reflexion'           // Inner monologue
    | 'planning'            // CUA planning, strategy
    | 'execution'           // CUA clicks, code gen
    | 'chat'                // User interaction
    | 'analysis'            // Data processing
    | 'synthesis';          // Cross-reference insights

    // Complexidade
    complexity: 'low' | 'medium' | 'high';

    // Características especiais
    requiresMultimodal?: boolean;    // Screenshots, images
    requiresCoding?: boolean;        // Code generation
    isCritical?: boolean;            // Business-critical decision

    // Contexto de budget
    tokenBudgetRemaining: number;    // USD restantes hoje

    // User preferences
    userPreference?: 'speed' | 'quality' | 'cost';

    // Feature tracking (para analytics)
    feature?: 'echo' | 'whisper' | 'cua' | 'curiosity' | 'heartbeat';
}

export class ModelRouter {
    constructor(private costTracker: CostTracker) { }

    /**
     * Seleciona o modelo ideal para a task
     */
    selectModel(context: TaskContext): string {
        // 🔴 EMERGENCY: Budget critical (<$0.10 restante)
        if (context.tokenBudgetRemaining < 0.10) {
            console.warn('[Router] BUDGET CRITICAL - Forcing cheapest model');
            return 'fast-responder';
        }

        // 🧠 STRATEGIC THINKING
        if (this.requiresStrategicThinking(context)) {
            return 'strategic-brain';
        }

        // 🤖 EXECUTION (multimodal, coding, tools)
        if (this.requiresExecution(context)) {
            return 'agile-executor';
        }

        // 💬 CHAT (user interaction)
        if (context.type === 'chat') {
            return this.selectChatModel(context);
        }

        // 📊 ANALYSIS (batch, retrieval-heavy)
        if (context.type === 'analysis') {
            return 'fast-responder';
        }

        // Default: Balanced executor
        return 'agile-executor';
    }

    /**
     * Requer pensamento estratégico? → Opus
     */
    private requiresStrategicThinking(context: TaskContext): boolean {
        // Reflexion profunda
        if (context.type === 'reflexion' && context.complexity === 'high') {
            return true;
        }

        // Planejamento estratégico
        if (context.type === 'planning' && context.isCritical) {
            return true;
        }

        // Synthesis de insights críticos
        if (context.type === 'synthesis' && context.isCritical) {
            return true;
        }

        // Whisper score 10 (notificação crítica)
        if (context.feature === 'whisper' && context.complexity === 'high') {
            return true;
        }

        return false;
    }

    /**
     * Requer execução agentic? → Kimi
     */
    private requiresExecution(context: TaskContext): boolean {
        // CUA (sempre Kimi - multimodal)
        if (context.type === 'execution' || context.feature === 'cua') {
            return true;
        }

        // Code generation
        if (context.requiresCoding) {
            return true;
        }

        // Multimodal (screenshot analysis)
        if (context.requiresMultimodal) {
            return true;
        }

        // Curiosity Engine (web research)
        if (context.feature === 'curiosity') {
            return true;
        }

        return false;
    }

    /**
     * Seleção específica para chat
     */
    private selectChatModel(context: TaskContext): string {
        // Perguntas simples → Gemini (rápido)
        if (context.complexity === 'low') {
            return 'fast-responder';
        }

        // User prefere qualidade → Opus
        if (context.userPreference === 'quality') {
            return 'strategic-brain';
        }

        // User prefere velocidade → Gemini
        if (context.userPreference === 'speed') {
            return 'fast-responder';
        }

        // Complexidade média ou alta → Kimi (balanced)
        return 'agile-executor';
    }

    /**
     * Retorna configuração de esforço para Opus
     */
    getEffortLevel(context: TaskContext): 'low' | 'medium' | 'high' | 'max' {
        if (!this.requiresStrategicThinking(context)) {
            return 'low'; // Não deveria estar usando Opus
        }

        if (context.isCritical) {
            return 'max'; // Business-critical decision
        }

        if (context.complexity === 'high') {
            return 'high';
        }

        if (context.complexity === 'medium') {
            return 'medium';
        }

        return 'low';
    }
}
