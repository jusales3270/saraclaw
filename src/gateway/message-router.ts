import { Session } from './session-manager.js';
import { TheEcho, OutgoingResponse } from './echo.js';
import { LLMClient } from '../agents/llm/llm-client.js';
import { ContextBridge } from './context-bridge.js';
import { CommandHandler } from './command-handler.js';
import { ChatHistory } from './chat-history.js';
import { TheCensor } from '../shield/the-censor.js';
import { v4 as uuidv4 } from 'uuid';

export interface IncomingMessage {
    type: 'chat' | 'command' | 'ping';
    content: string;
    metadata?: {
        conversationId?: string;
        replyTo?: string;
    };
}

export interface OutgoingMessage {
    type: 'message' | 'error' | 'system' | 'whisper';
    content: string;
    messageId?: string;
    metadata?: {
        cost?: number;
        model?: string;
        latency?: number;
        cached?: boolean;
        error?: string;
    };
}

export class MessageRouter {
    private echo: TheEcho;
    private contextBridge: ContextBridge;
    private commandHandler: CommandHandler;
    private chatHistory: ChatHistory;
    private censor: TheCensor;
    private llmClient: LLMClient;

    constructor() {
        this.chatHistory = new ChatHistory();
        this.llmClient = new LLMClient();
        this.echo = new TheEcho(this.llmClient);
        this.contextBridge = new ContextBridge();
        this.commandHandler = new CommandHandler(this.chatHistory);
        // Censor with default config
        this.censor = new TheCensor();
    }

    /**
     * Route incoming message to appropriate handler
     */
    async route(
        session: Session,
        message: IncomingMessage
    ): Promise<OutgoingMessage | null> {
        const startTime = Date.now();

        // Ping/pong (keep-alive)
        if (message.type === 'ping') {
            return { type: 'system', content: 'pong' };
        }

        // Special commands (/help, /stats, etc.)
        if (message.type === 'command' || (message.content && message.content.startsWith('/'))) {
            return this.handleCommand(session, message);
        }

        // Regular chat
        if (message.type === 'chat') {
            return this.handleChat(session, message, startTime);
        }

        return {
            type: 'error',
            content: `Tipo de mensagem desconhecido: ${message.type}`
        };
    }

    /**
     * Handle chat message (Echo)
     */
    private async handleChat(
        session: Session,
        message: IncomingMessage,
        startTime: number
    ): Promise<OutgoingMessage> {
        try {
            // 1. Get or create conversation
            const conversationId = message.metadata?.conversationId ||
                session.metadata.conversationId ||
                this.chatHistory.getOrCreateConversation(session.id);

            session.metadata.conversationId = conversationId;

            // 2. Get chat history
            // Fetch more history for smarter context
            const history = this.chatHistory.getHistory(conversationId, 20);

            // 3. Get user context from OpenAugi
            const userContext = await this.contextBridge.getUserContext(
                message.content,
                { conversationHistory: history }
            );

            // 4. Generate response via TheEcho
            // Map ChatMessage to EchoOptions format
            const conversationHistory = history.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // Pass user context as part of system prompt or raw context
            // For now, simpler to append to system prompt or let TheEcho handle if it supported raw context.
            // But EchoOptions has `context` (TaskContext) and `systemPrompt`.
            // We can enrich system prompt with user context.
            const systemPrompt = `User Context:\n${JSON.stringify(userContext, null, 2)}\n\nYou are Sara.`;

            const echoResponse = await this.echo.respond(message.content, {
                context: {
                    type: 'chat',
                    complexity: 'low', // Could be dynamic based on intent analysis
                    feature: 'echo',
                    tokenBudgetRemaining: 0 // Will be overwritten by LLMClient
                },
                conversationHistory,
                systemPrompt
            });

            // 5. Censor output (TheEcho output content. Censor acts as final gate)
            // Note: Echo might have internal safeguards, but we use TheCensor here for safety.
            // If TheEcho response is already safe, this is double check.
            const censorResult = this.censor.scan(echoResponse.content);
            const content = censorResult.hasSensitiveData ? censorResult.redacted : echoResponse.content;

            if (censorResult.hasSensitiveData) {
                console.log('[MessageRouter] Censored response content.');
            }

            // 6. Save to history
            this.chatHistory.addMessage(
                conversationId,
                'user',
                message.content
            );

            const messageId = this.chatHistory.addMessage(
                conversationId,
                'assistant',
                content,
                {
                    model: echoResponse.model,
                    cost: echoResponse.usage.cost,
                    latency: echoResponse.metadata.latency,
                    cached: echoResponse.metadata.cached
                }
            );

            // 7. Return response
            return {
                type: 'message',
                content: content,
                messageId,
                metadata: {
                    cost: echoResponse.usage.cost,
                    model: echoResponse.model,
                    latency: echoResponse.metadata.latency,
                    cached: echoResponse.metadata.cached,
                    error: undefined
                }
            };

        } catch (error: any) {
            console.error('[MessageRouter] Chat error:', error);

            return {
                type: 'error',
                content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
                metadata: {
                    error: error.message
                }
            };
        }
    }

    /**
     * Handle special commands
     */
    private async handleCommand(
        session: Session,
        message: IncomingMessage
    ): Promise<OutgoingMessage> {
        try {
            const result = await this.commandHandler.execute(
                message.content,
                session
            );

            return {
                type: 'system',
                content: result
            };
        } catch (error: any) {
            console.error('[MessageRouter] Command error:', error);

            return {
                type: 'error',
                content: `Erro ao executar comando: ${error.message}`
            };
        }
    }

    /**
     * Get chat history instance (for external access)
     */
    getChatHistory(): ChatHistory {
        return this.chatHistory;
    }
}
