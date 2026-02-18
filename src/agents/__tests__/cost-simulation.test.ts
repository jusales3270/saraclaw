
import { describe, it, expect, vi } from 'vitest';
import { LLMClient } from '../llm/llm-client';
import { TaskContext } from '../llm/model-router';

// Mock process.env
vi.stubEnv('NODE_ENV', 'test');

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
    return {
        default: class Database {
            prepare() {
                return {
                    run: vi.fn(),
                    get: vi.fn(),
                    all: vi.fn().mockReturnValue([])
                };
            }
            exec() { }
            transaction(fn: Function) { return fn; }
            pragma() { }
        }
    };
});

// Mock SARA models pricing for simulation
vi.mock('../llm/model-config', async () => {
    const actual = await vi.importActual('../llm/model-config');
    return {
        ...actual,
        SARA_MODELS: {
            'strategic-brain': {
                id: 'anthropic/claude-opus-4-20250514',
                name: 'Claude Opus 4.6',
                pricing: { input: 5.00, output: 25.00, cached: 1.25 },
                features: { effortControl: true, promptCaching: true },
                maxRetries: 2
            },
            'agile-executor': {
                id: 'moonshotai/kimi-k2.5',
                name: 'Kimi K2.5',
                pricing: { input: 0.50, output: 2.80, cached: 0.10 },
                features: { promptCaching: true },
                maxRetries: 3
            },
            'fast-responder': {
                id: 'google/gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                pricing: { input: 0.30, output: 2.50 },
                features: { batchAPI: true },
                maxRetries: 3
            }
        }
    };
});

describe('Cost Simulation - Typical Day', () => {
    it('should stay within $2.00 budget for typical usage', async () => {
        const client = new LLMClient();

        // Mock the API calls with realistic token counts based on the task
        // @ts-ignore
        client.client.messages.create = vi.fn().mockImplementation((params) => {
            let input = 1000;
            let output = 500;
            let cached = 0;

            // Simulating different loads based on model
            if (params.model.includes('opus')) {
                input = 5000;
                output = 1000;
            } else if (params.model.includes('kimi')) {
                input = 3000;
                output = 800;
            } else {
                // Gemini / fast
                input = 500;
                output = 200;
            }

            return Promise.resolve({
                content: [{ text: 'Mock response' }],
                usage: {
                    input_tokens: input,
                    output_tokens: output,
                    cache_read_input_tokens: cached
                }
            });
        });


        // Simulate 1 day of Sara usage
        const tasks: Array<{ prompt: string; context: TaskContext }> = [
            // 30 heartbeats (reflexion light)
            ...Array(30).fill({
                prompt: 'Quick check',
                context: {
                    type: 'reflexion' as const,
                    complexity: 'low' as const,
                    tokenBudgetRemaining: 2.00,
                    feature: 'heartbeat' as const
                }
            }),

            // 50 simple chats
            ...Array(50).fill({
                prompt: 'Simple question',
                context: {
                    type: 'chat' as const,
                    complexity: 'low' as const,
                    tokenBudgetRemaining: 2.00,
                    feature: 'echo' as const
                }
            }),

            // 5 CUA executions
            ...Array(5).fill({
                prompt: 'Fill form',
                context: {
                    type: 'execution' as const,
                    complexity: 'medium' as const,
                    requiresMultimodal: true,
                    tokenBudgetRemaining: 2.00,
                    feature: 'cua' as const
                }
            }),

            // 2 strategic plans
            ...Array(2).fill({
                prompt: 'Deep planning',
                context: {
                    type: 'planning' as const,
                    complexity: 'high' as const,
                    isCritical: true,
                    tokenBudgetRemaining: 2.00,
                    feature: 'cua' as const
                }
            })
        ];

        let totalCost = 0;

        for (const task of tasks) {
            const response = await client.chat(task.prompt, { context: task.context });
            totalCost += response.usage.cost;
        }

        console.log(`Total cost: $${totalCost.toFixed(2)}`);

        expect(totalCost).toBeLessThan(2.00);
    });
});
