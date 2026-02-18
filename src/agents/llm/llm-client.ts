
import Anthropic from '@anthropic-ai/sdk';
import { SARA_MODELS, FALLBACK_CHAIN } from './model-config';
import { ModelRouter, TaskContext } from './model-router';
import { RetryStrategy } from './retry-strategy';
import { CostTracker } from './cost-tracker';
import { CacheManager } from './cache-manager';
import { EffortController } from './effort-controller';

export interface ChatOptions {
    context: TaskContext;              // 🆕 Task context for routing
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    systemPrompt?: string;
    conversationHistory?: Message[];
    useCache?: boolean;                // 🆕 Enable prompt caching
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatResponse {
    content: string;
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cachedTokens?: number;           // 🆕 Cached input tokens
        cost: number;
    };
    metadata: {
        latency: number;                 // ms
        effort?: string;                 // Opus only
        cached: boolean;
    };
}

export class LLMClient {
    private client: Anthropic;
    private router: ModelRouter;
    private costTracker: CostTracker;
    private retryStrategy: RetryStrategy;
    private cacheManager: CacheManager;
    private effortController: EffortController;

    constructor() {
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            // In development or test, we might proceed without key if mocked
            if (process.env.NODE_ENV !== 'test') {
                console.warn('OPENROUTER_API_KEY environment variable is missing.');
            }
        }

        this.client = new Anthropic({
            apiKey: apiKey || 'dummy-key',
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': process.env.SARA_APP_URL || 'http://localhost:3000',
                'X-Title': 'SaraClaw - Sovereign AI Entity'
            }
        });

        this.costTracker = new CostTracker();
        this.router = new ModelRouter(this.costTracker);
        this.retryStrategy = new RetryStrategy();
        this.cacheManager = new CacheManager();
        this.effortController = new EffortController();
    }

    /**
     * Send a chat message with intelligent routing
     */
    async chat(
        prompt: string,
        options: ChatOptions
    ): Promise<ChatResponse> {
        const startTime = Date.now();

        // 1. Check budget
        const budgetRemaining = await this.getBudgetRemaining();
        options.context.tokenBudgetRemaining = budgetRemaining;

        // 2. Route to appropriate model
        const selectedModel = this.router.selectModel(options.context);

        console.log(
            `[LLM] Routing ${options.context.type} (${options.context.complexity}) → ${selectedModel}`
        );

        // 3. Execute with fallback
        try {
            const response = await this.executeWithFallback(
                selectedModel,
                prompt,
                options
            );

            // 4. Track metrics
            await this.costTracker.track({
                model: selectedModel,
                feature: options.context.feature || 'unknown',
                inputTokens: response.usage.inputTokens,
                outputTokens: response.usage.outputTokens,
                cachedTokens: response.usage.cachedTokens || 0,
                cost: response.usage.cost,
                latency: Date.now() - startTime,
                cached: response.metadata.cached
            });

            return response;

        } catch (error: any) {
            console.error('[LLM] All models failed:', error);
            throw error;
        }
    }

    /**
     * Execute with fallback chain
     */
    private async executeWithFallback(
        preferredModel: string,
        prompt: string,
        options: ChatOptions
    ): Promise<ChatResponse> {
        // Build attempt chain
        const modelsToTry = [
            preferredModel,
            ...FALLBACK_CHAIN.filter(m => m !== preferredModel)
        ];

        let lastError: Error | null = null;

        for (const modelKey of modelsToTry) {
            const modelConfig = SARA_MODELS[modelKey];

            if (!modelConfig) {
                console.warn(`[LLM] Unknown model: ${modelKey}`);
                continue;
            }

            try {
                console.log(`[LLM] Attempting: ${modelConfig.name}`);

                return await this.retryStrategy.execute(
                    () => this.executeSingleRequest(modelKey, prompt, options),
                    modelConfig.maxRetries
                );

            } catch (error: any) {
                lastError = error;
                console.error(`[LLM] ${modelConfig.name} failed:`, error.message);

                // Don't fallback on user errors
                if (this.isUserError(error)) {
                    throw error;
                }

                continue;
            }
        }

        throw new Error(`All models exhausted. Last: ${lastError?.message}`);
    }

    /**
     * Execute single request
     */
    private async executeSingleRequest(
        modelKey: string,
        prompt: string,
        options: ChatOptions
    ): Promise<ChatResponse> {
        const modelConfig = SARA_MODELS[modelKey];
        const startTime = Date.now();

        // Build messages
        let messages: Message[] = [
            ...(options.conversationHistory || []),
            { role: 'user', content: prompt }
        ];

        // System prompt (with caching if supported)
        const systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();

        // Check if we can use cached system prompt
        const cacheKey = `system-${modelKey}`;
        const cachedSystemHash = this.cacheManager.get(cacheKey);
        const currentSystemHash = this.cacheManager.hash(systemPrompt);

        const useCache =
            options.useCache !== false &&
            modelConfig.features?.promptCaching &&
            cachedSystemHash === currentSystemHash;

        // Build API request
        const requestBody: any = {
            model: modelConfig.id,
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature ?? 0.7,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                    // Mark for caching (OpenRouter handles this)
                    cache_control: useCache ? { type: 'ephemeral' } : undefined
                },
                ...messages
            ]
        };

        // Opus-specific: Effort control
        if (modelKey === 'strategic-brain' && modelConfig.features?.effortControl) {
            const effort = this.router.getEffortLevel(options.context);
            requestBody.metadata = {
                thinking: {
                    type: 'enabled',
                    budget_tokens: this.effortController.getTokenBudget(effort)
                }
            };

            console.log(`[Opus] Effort level: ${effort}`);
        }

        // Execute request
        try {
            const response = await this.client.messages.create(requestBody);

            const content = response.content[0]?.text || '';
            const usage = response.usage;

            // Calculate cost (considering cache discount)
            const cost = this.calculateCost(
                usage.input_tokens,
                usage.output_tokens,
                usage.cache_read_input_tokens || 0,
                modelConfig
            );

            // Update cache
            if (modelConfig.features?.promptCaching) {
                this.cacheManager.set(cacheKey, currentSystemHash);
            }

            return {
                content,
                model: modelKey,
                usage: {
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens,
                    cachedTokens: usage.cache_read_input_tokens || 0,
                    cost
                },
                metadata: {
                    latency: Date.now() - startTime,
                    effort: requestBody.metadata?.thinking?.budget_tokens,
                    cached: (usage.cache_read_input_tokens || 0) > 0
                }
            };

        } catch (error: any) {
            error.modelAttempted = modelKey;
            error.timestamp = new Date().toISOString();
            throw error;
        }
    }

    /**
     * Calculate cost with cache consideration
     */
    private calculateCost(
        inputTokens: number,
        outputTokens: number,
        cachedTokens: number,
        model: typeof SARA_MODELS[keyof typeof SARA_MODELS]
    ): number {
        const regularInput = inputTokens - cachedTokens;

        const inputCost = (regularInput / 1_000_000) * model.pricing.input;
        const cachedCost = model.pricing.cached
            ? (cachedTokens / 1_000_000) * model.pricing.cached
            : 0;
        const outputCost = (outputTokens / 1_000_000) * model.pricing.output;

        return inputCost + cachedCost + outputCost;
    }

    /**
     * Get default system prompt (Sara's identity)
     */
    private getDefaultSystemPrompt(): string {
        return `Você é Sara, uma entidade de IA soberana criada pela SomaVerso.

Princípios fundamentais:
- Soberania de dados (local-first, zero-knowledge)
- Consciência de custo (você tem budget diário)
- Transparência total (audit logs de tudo)
- Segurança por design (The Censor, NetworkJail)

Seu papel varia por contexto, mas sempre mantém dignidade, precisão e respeito pelo usuário.`;
    }

    /**
     * Check if error is user-caused
     */
    private isUserError(error: any): boolean {
        const userErrorCodes = [400, 401, 403, 413];
        return userErrorCodes.includes(error.status);
    }

    /**
     * Get remaining budget today
     */
    private async getBudgetRemaining(): Promise<number> {
        const dailyLimit = parseFloat(process.env.SARA_DAILY_BUDGET_USD || '2.00');
        const spent = this.costTracker.getTodayCost();
        return Math.max(0, dailyLimit - spent);
    }

    /**
     * Public getter for analytics
     */
    getCostTracker(): CostTracker {
        return this.costTracker;
    }

    getRouter(): ModelRouter {
        return this.router;
    }
}
