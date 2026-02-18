import { Session } from './session-manager.js';
import { LLMClient } from '../agents/llm/llm-client.js';
import { ChatHistory } from './chat-history.js';
import { SaraScheduler as Scheduler } from '../heart/scheduler.js';

export class CommandHandler {
    private commands = new Map<string, (args: string[], session: Session) => Promise<string>>();
    private chatHistory: ChatHistory;

    constructor(chatHistory: ChatHistory) {
        this.chatHistory = chatHistory;
        this.registerCommands();
    }

    private registerCommands() {
        // Help
        this.commands.set('help', async () => {
            return `📚 **Comandos Disponíveis:**

*Estatísticas:*
• /stats - Uso de tokens e custos por feature
• /budget - Orçamento restante hoje
• /history - Estatísticas da conversa atual

*Controle:*
• /pause - Pausa batimentos autônomos
• /resume - Resume batimentos
• /status - Status da Sara (heartbeat, uptime)

*Conversa:*
• /clear - Limpa histórico desta conversa
• /search <query> - Busca em conversas antigas

• /help - Mostra esta mensagem`;
        });

        // Usage stats
        this.commands.set('stats', async () => {
            const llmClient = new LLMClient();
            const tracker = llmClient.getCostTracker();
            const today = new Date().toISOString().split('T')[0];
            const breakdown = tracker.getFeatureBreakdown(today);

            if (breakdown.length === 0) {
                return '📊 Nenhum uso registrado hoje.';
            }

            let response = '📊 **Estatísticas de Hoje:**\n\n';

            breakdown.forEach(stat => {
                const feature = stat.feature.charAt(0).toUpperCase() + stat.feature.slice(1);
                response += `• ${feature}: ${stat.requests} requests, $${stat.totalCost.toFixed(3)}\n`;
                response += `  Cache hit rate: ${stat.cacheHitRate.toFixed(1)}%\n`;
            });

            const total = breakdown.reduce((sum, s) => sum + s.totalCost, 0);
            const totalRequests = breakdown.reduce((sum, s) => sum + s.requests, 0);

            response += `\n**Total:** ${totalRequests} requests, $${total.toFixed(2)}`;

            return response;
        });

        // Budget remaining
        this.commands.set('budget', async () => {
            const llmClient = new LLMClient();
            const tracker = llmClient.getCostTracker();
            const spent = tracker.getTodayCost();
            const limit = parseFloat(process.env.SARA_DAILY_BUDGET_USD || '2.00');
            const remaining = limit - spent;
            const percentage = (remaining / limit) * 100;

            let emoji = '💰';
            if (percentage < 10) emoji = '🔴';
            else if (percentage < 30) emoji = '🟡';

            return `${emoji} **Orçamento:**

• Gasto hoje: $${spent.toFixed(2)}
• Limite diário: $${limit.toFixed(2)}
• Restante: $${remaining.toFixed(2)} (${percentage.toFixed(1)}%)

${percentage < 20 ? '⚠️  Orçamento baixo! Sara vai priorizar modelos mais baratos.' : ''}`;
        });

        // Conversation history stats
        this.commands.set('history', async (args, session) => {
            const conversationId = session.metadata.conversationId;

            if (!conversationId) {
                return '❌ Nenhuma conversa ativa.';
            }

            const conversation = this.chatHistory.getConversation(conversationId);

            if (!conversation) {
                return '❌ Conversa não encontrada.';
            }

            const history = this.chatHistory.getHistory(conversationId, 100);
            const userMsgs = history.filter(m => m.role === 'user').length;
            const assistantMsgs = history.filter(m => m.role === 'assistant').length;

            const totalCost = history
                .filter(m => m.metadata?.cost)
                .reduce((sum, m) => sum + (m.metadata!.cost || 0), 0);

            return `💬 **Histórico da Conversa:**

• Mensagens: ${conversation.messageCount} (${userMsgs} suas, ${assistantMsgs} minhas)
• Custo total: $${totalCost.toFixed(3)}
• Iniciada: ${conversation.createdAt.toLocaleString('pt-BR')}
• Última atividade: ${conversation.updatedAt.toLocaleString('pt-BR')}`;
        });

        // Clear conversation
        this.commands.set('clear', async (args, session) => {
            const conversationId = session.metadata.conversationId;

            if (!conversationId) {
                return '❌ Nenhuma conversa ativa para limpar.';
            }

            this.chatHistory.deleteConversation(conversationId);

            // Create new conversation
            const newConvId = this.chatHistory.createConversation(session.id);
            session.metadata.conversationId = newConvId;

            return '🗑️  Histórico de conversa limpo. Começando nova conversa.';
        });

        // Search in history
        this.commands.set('search', async (args) => {
            const query = args.join(' ');

            if (!query) {
                return '❌ Uso: /search <termo de busca>';
            }

            const results = this.chatHistory.searchMessages(query, 5);

            if (results.length === 0) {
                return `🔍 Nenhum resultado encontrado para "${query}"`;
            }

            let response = `🔍 **Encontrados ${results.length} resultados para "${query}":**\n\n`;

            results.forEach((msg, i) => {
                const preview = msg.content.substring(0, 80) + (msg.content.length > 80 ? '...' : '');
                const date = msg.createdAt.toLocaleDateString('pt-BR');
                response += `${i + 1}. [${date}] ${msg.role}: ${preview}\n`;
            });

            return response;
        });

        // Sara status
        this.commands.set('status', async () => {
            try {
                const scheduler = Scheduler.getInstance();
                const metrics = scheduler.getMetrics();
                const state = scheduler.getState();
                const isRunning = state !== 'STOPPED' && state !== 'SHUTDOWN' && state !== 'ERROR';

                const uptime = Date.now() - metrics.startedAt.getTime();
                const uptimeMinutes = Math.floor(uptime / 60000);
                const uptimeHours = Math.floor(uptimeMinutes / 60);
                const uptimeMins = uptimeMinutes % 60;

                const idleRate = metrics.successfulPulses > 0
                    ? (metrics.idlePulses / metrics.successfulPulses)
                    : 0;

                const actionRate = metrics.successfulPulses > 0
                    ? (metrics.researchPulses / metrics.successfulPulses)
                    : 0;

                return `🫀 **Status da Sara:**

• Estado: ${state} (${isRunning ? '🟢 Ativa' : '🔴 Pausada'})
• Uptime: ${uptimeHours}h ${uptimeMins}min
• Total Pulsos: ${metrics.totalPulses}
• Taxa de Sucesso: ${metrics.successfulPulses > 0 ? ((metrics.successfulPulses / metrics.totalPulses) * 100).toFixed(1) : 0}%
• Idle Rate: ${(idleRate * 100).toFixed(1)}%
• Action Rate: ${(actionRate * 100).toFixed(1)}%

${isRunning ? '✨ Operando normalmente' : '⏸️  Batimentos pausados'}`;
            } catch (error) {
                return '⚠️  Scheduler não inicializado ainda.';
            }
        });

        // Pause heartbeat
        this.commands.set('pause', async () => {
            try {
                const scheduler = Scheduler.getInstance();
                scheduler.stop();
                return '⏸️  **Batimentos autônomos pausados**\n\nSara não vai mais fazer ciclos de reflexão automáticos. Use /resume para reativar.';
            } catch (error) {
                return '⚠️  Scheduler não disponível.';
            }
        });

        // Resume heartbeat
        this.commands.set('resume', async () => {
            try {
                const scheduler = Scheduler.getInstance();
                scheduler.start();
                return '▶️  **Batimentos autônomos resumidos**\n\nSara voltou a fazer ciclos de reflexão automáticos. (Nota: Scheduler pode precisar de inicialização manual se não começou)';
            } catch (error) {
                return '⚠️  Scheduler não disponível.';
            }
        });
    }

    /**
     * Execute command
     */
    async execute(input: string, session: Session): Promise<string> {
        // Parse command
        const trimmed = input.trim();
        const parts = trimmed.startsWith('/')
            ? trimmed.substring(1).split(/\s+/)
            : trimmed.split(/\s+/);

        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Find handler
        const handler = this.commands.get(commandName);

        if (!handler) {
            return `❌ Comando desconhecido: **/${commandName}**\n\nUse /help para ver comandos disponíveis.`;
        }

        try {
            return await handler(args, session);
        } catch (error: any) {
            console.error(`[CommandHandler] Error executing ${commandName}:`, error);
            return `❌ Erro ao executar comando: ${error.message}`;
        }
    }
}
