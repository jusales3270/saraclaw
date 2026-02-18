
export interface ModelConfig {
    id: string;                        // OpenRouter model ID
    name: string;                      // Display name
    provider: 'anthropic' | 'moonshot' | 'google';
    contextWindow: number;             // Max tokens
    pricing: {
        input: number;                   // $ per 1M tokens
        output: number;                  // $ per 1M tokens
        cached?: number;                 // $ per 1M cached tokens
    };
    capabilities: {
        reasoning: 'basic' | 'advanced' | 'expert';
        multimodal: boolean;
        coding: boolean;
        speed: 'fast' | 'medium' | 'slow';
    };
    maxRetries: number;
    timeout: number;                   // ms
    features?: {
        effortControl?: boolean;         // Opus only
        promptCaching?: boolean;         // Kimi, Claude
        batchAPI?: boolean;              // Gemini
    };
}

export const SARA_MODELS: Record<string, ModelConfig> = {
    'strategic-brain': {
        id: 'anthropic/claude-opus-4-20250514',
        name: 'Claude Opus 4.6',
        provider: 'anthropic',
        contextWindow: 1_000_000,        // 1M tokens
        pricing: {
            input: 5.00,
            output: 25.00,
            cached: 1.25                   // 75% discount on cached
        },
        capabilities: {
            reasoning: 'expert',           // Adaptive thinking
            multimodal: false,
            coding: true,
            speed: 'slow'
        },
        maxRetries: 2,
        timeout: 120000,                 // 2 min (deep reasoning)
        features: {
            effortControl: true,           // Low/Medium/High/Max
            promptCaching: true
        }
    },

    'agile-executor': {
        id: 'moonshotai/kimi-k2.5',
        name: 'Kimi K2.5',
        provider: 'moonshot',
        contextWindow: 262_000,          // 262K tokens
        pricing: {
            input: 0.50,
            output: 2.80,
            cached: 0.10                   // 80% discount
        },
        capabilities: {
            reasoning: 'advanced',
            multimodal: true,              // Visual coding
            coding: true,
            speed: 'medium'
        },
        maxRetries: 3,
        timeout: 90000,
        features: {
            promptCaching: true
        }
    },

    'fast-responder': {
        id: 'google/gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'google',
        contextWindow: 1_000_000,
        pricing: {
            input: 0.30,
            output: 2.50
        },
        capabilities: {
            reasoning: 'basic',
            multimodal: true,
            coding: false,
            speed: 'fast'
        },
        maxRetries: 3,
        timeout: 30000,                  // 30s
        features: {
            batchAPI: true                 // 50% discount
        }
    }
};

// Fallback chain (usado quando router falha ou budget crítico)
export const FALLBACK_CHAIN = [
    'agile-executor',      // Try Kimi first (balanced)
    'fast-responder',      // Then Gemini (cheapest)
    'strategic-brain'      // Opus last resort (expensive)
];
