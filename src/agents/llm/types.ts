
export type ModelProvider = 'anthropic' | 'moonshot' | 'google';

export type TaskType =
    | 'reflexion'
    | 'planning'
    | 'execution'
    | 'chat'
    | 'analysis'
    | 'synthesis';

export type EffortLevel = 'low' | 'medium' | 'high' | 'max';

export interface LLMError extends Error {
    status?: number;
    code?: string;
    modelAttempted?: string;
    timestamp?: string;
}

export interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
}
