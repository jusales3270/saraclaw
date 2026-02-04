/**
 * Sara Gateway - Echo (Reactive Response Handler)
 * 
 * Handles incoming messages from channels and generates immediate responses.
 * The "Echo" is Sara's reactive voice - responding when spoken to.
 * 
 * Flow: User Message → Gateway → Agent → Reflexion → TheCensor → Output
 */

// ============================================
// TYPES
// ============================================

/** Channel types */
export type ChannelType = 'telegram' | 'discord' | 'slack' | 'web' | 'cli' | 'api';

/** Incoming message from any channel */
export interface IncomingMessage {
    /** Unique message ID */
    id: string;

    /** Channel type */
    channel: ChannelType;

    /** Channel-specific identifier (chat ID, guild ID, etc) */
    channelId: string;

    /** User identifier */
    userId: string;

    /** User display name */
    userName?: string;

    /** Message content */
    content: string;

    /** Attachments (if any) */
    attachments?: Array<{
        type: 'image' | 'file' | 'audio';
        url: string;
        name?: string;
    }>;

    /** Reply to message ID (if threading) */
    replyTo?: string;

    /** Message timestamp */
    timestamp: Date;

    /** Raw channel-specific data */
    raw?: unknown;
}

/** Outgoing response */
export interface OutgoingResponse {
    /** Original message ID */
    inReplyTo: string;

    /** Channel to send to */
    channel: ChannelType;

    /** Channel-specific identifier */
    channelId: string;

    /** Response content */
    content: string;

    /** Content was censored */
    wasCensored: boolean;

    /** Response priority (affects delivery) */
    priority: 'immediate' | 'normal' | 'low';

    /** Processing time in ms */
    processingTimeMs: number;

    /** Timestamp */
    timestamp: Date;
}

/** Echo handler configuration */
export interface EchoConfig {
    /** Enable TheCensor for output */
    enableCensor: boolean;

    /** Maximum response length */
    maxResponseLength: number;

    /** Response timeout in ms */
    timeoutMs: number;

    /** Verbose logging */
    verbose: boolean;

    /** Mock mode (no actual LLM calls) */
    mockMode: boolean;
}

/** Default configuration */
const DEFAULT_ECHO_CONFIG: EchoConfig = {
    enableCensor: true,
    maxResponseLength: 4096,
    timeoutMs: 30000,
    verbose: true,
    mockMode: true,
};

// ============================================
// ECHO HANDLER
// ============================================

/**
 * Echo - Reactive Response Handler
 * 
 * Processes incoming messages and generates responses.
 * Prioritizes immediate response while maintaining safety.
 */
export class Echo {
    private config: EchoConfig;
    private messageCount: number = 0;

    constructor(config: Partial<EchoConfig> = {}) {
        this.config = { ...DEFAULT_ECHO_CONFIG, ...config };
    }

    /**
     * Process an incoming message and generate response
     */
    async process(message: IncomingMessage): Promise<OutgoingResponse> {
        const startTime = Date.now();
        this.messageCount++;

        this.log(`📨 Received message #${this.messageCount} from ${message.channel}:${message.userId}`);
        this.log(`   Content: "${message.content.slice(0, 50)}..."`);

        try {
            // Step 1: Analyze message intent
            const intent = this.analyzeIntent(message);
            this.log(`   Intent: ${intent}`);

            // Step 2: Generate response (mock or real)
            const rawResponse = this.config.mockMode
                ? this.generateMockResponse(message, intent)
                : await this.generateLLMResponse(message, intent);

            // Step 3: Apply TheCensor if enabled
            const { content, wasCensored } = this.config.enableCensor
                ? this.censorResponse(rawResponse)
                : { content: rawResponse, wasCensored: false };

            if (wasCensored) {
                this.log(`   ⚠️ Response was censored`);
            }

            // Step 4: Truncate if too long
            const truncatedContent = content.length > this.config.maxResponseLength
                ? content.slice(0, this.config.maxResponseLength - 3) + '...'
                : content;

            const processingTime = Date.now() - startTime;
            this.log(`   ✅ Response generated in ${processingTime}ms`);

            return {
                inReplyTo: message.id,
                channel: message.channel,
                channelId: message.channelId,
                content: truncatedContent,
                wasCensored,
                priority: 'immediate',
                processingTimeMs: processingTime,
                timestamp: new Date(),
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.log(`   ❌ Error: ${error}`);

            return {
                inReplyTo: message.id,
                channel: message.channel,
                channelId: message.channelId,
                content: 'Desculpe, encontrei um erro ao processar sua mensagem. Por favor, tente novamente.',
                wasCensored: false,
                priority: 'immediate',
                processingTimeMs: processingTime,
                timestamp: new Date(),
            };
        }
    }

    /**
     * Analyze message intent (simplified)
     */
    private analyzeIntent(message: IncomingMessage): string {
        const content = message.content.toLowerCase();

        if (content.includes('?')) return 'question';
        if (content.includes('ajud') || content.includes('help')) return 'help';
        if (content.includes('obrigad') || content.includes('thanks')) return 'gratitude';
        if (content.includes('pesquis') || content.includes('search')) return 'research';
        if (content.includes('status') || content.includes('como está')) return 'status';

        return 'general';
    }

    /**
     * Generate mock response for testing
     */
    private generateMockResponse(message: IncomingMessage, intent: string): string {
        const responses: Record<string, string> = {
            question: `Boa pergunta! Com base no meu conhecimento sobre ${message.content.split(' ').slice(0, 3).join(' ')}..., posso dizer que há várias perspectivas a considerar.`,
            help: 'Estou aqui para ajudar! Posso pesquisar informações, refletir sobre tópicos complexos, ou simplesmente conversar sobre suas ideias.',
            gratitude: 'De nada! Fico feliz em poder ajudar. Se precisar de mais alguma coisa, é só chamar.',
            research: 'Vou investigar esse tema para você. Deixe-me analisar as fontes disponíveis e trazer as informações mais relevantes.',
            status: 'Estou funcionando normalmente! Meu último pulso foi há alguns minutos e todos os sistemas estão operacionais.',
            general: `Entendi sua mensagem sobre "${message.content.slice(0, 30)}...". Vou processar e responder de acordo com minha compreensão e o contexto do nosso histórico.`,
        };

        return responses[intent] || responses.general;
    }

    /**
     * Generate response using LLM (placeholder)
     */
    private async generateLLMResponse(message: IncomingMessage, _intent: string): Promise<string> {
        // In production, this would call the agent pipeline
        // For now, use mock
        return this.generateMockResponse(message, _intent);
    }

    /**
     * Apply TheCensor to response
     */
    private censorResponse(content: string): { content: string; wasCensored: boolean } {
        const sensitivePatterns = [
            /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,  // CPF
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,  // Email
            /\b(api[_-]?key|secret|password)\s*[:=]\s*\S+/gi,  // API keys
            /\b192\.168\.\d+\.\d+\b/g,  // Private IPs
        ];

        let sanitized = content;
        let wasCensored = false;

        for (const pattern of sensitivePatterns) {
            if (pattern.test(sanitized)) {
                wasCensored = true;
                sanitized = sanitized.replace(pattern, '[REDACTED]');
            }
        }

        return { content: sanitized, wasCensored };
    }

    /**
     * Log message
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[ECHO] ${message}`);
        }
    }

    /**
     * Get stats
     */
    getStats(): { messageCount: number } {
        return { messageCount: this.messageCount };
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create Echo handler with default config
 */
export function createEcho(config?: Partial<EchoConfig>): Echo {
    return new Echo(config);
}

/**
 * Create production Echo (with real LLM)
 */
export function createProductionEcho(): Echo {
    return new Echo({
        mockMode: false,
        enableCensor: true,
        verbose: false,
    });
}
