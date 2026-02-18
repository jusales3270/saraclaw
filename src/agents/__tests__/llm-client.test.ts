
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LLMClient } from '../llm/llm-client';
import { TaskContext } from '../llm/model-router';

// Mock process.env
vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
vi.stubEnv('SARA_DAILY_BUDGET_USD', '2.00');
vi.stubEnv('NODE_ENV', 'test'); // Ensure we use :memory: db

// Mock better-sqlite3 to avoid binary issues if any
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

describe('LLMClient - Multi-Model Orchestration', () => {
    let client: LLMClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new LLMClient();
        // Mock the actual API call to avoid network requests
        // @ts-ignore
        client.client.messages.create = vi.fn().mockResolvedValue({
            content: [{ text: 'Mock response' }],
            usage: {
                input_tokens: 100,
                output_tokens: 50,
                cache_read_input_tokens: 0
            }
        });
    });

    describe('Model Routing', () => {
        it('should use Gemini for simple chat', async () => {
            const context: TaskContext = {
                type: 'chat',
                complexity: 'low',
                tokenBudgetRemaining: 2.00
            };

            const response = await client.chat('Hello!', { context });

            expect(response.model).toBe('fast-responder');
            // Gemini cost: (100/1M * 0.30) + (50/1M * 2.50) = 0.00003 + 0.000125 = 0.000155
            expect(response.usage.cost).toBeLessThan(0.01);
        });

        it('should use Opus for strategic planning', async () => {
            const context: TaskContext = {
                type: 'planning',
                complexity: 'high',
                isCritical: true,
                tokenBudgetRemaining: 2.00,
                feature: 'cua'
            };

            const response = await client.chat(
                'Plan how to fill this complex form',
                { context }
            );

            expect(response.model).toBe('strategic-brain');
            expect(response.metadata.effort).toBeDefined();
        });

        it('should use Kimi for CUA execution', async () => {
            const context: TaskContext = {
                type: 'execution',
                complexity: 'medium',
                requiresMultimodal: true,
                tokenBudgetRemaining: 2.00,
                feature: 'cua'
            };

            const response = await client.chat(
                'Click the submit button',
                { context }
            );

            expect(response.model).toBe('agile-executor');
        });

        it('should fallback to cheapest model when budget critical', async () => {
            // Direct manipulation of cost tracker for this test
            // Since we mocked sqlite, we need to mock the getTodayCost method of the tracker directly
            // OR update the mocked DB logic.
            // Easiest is to spy on the tracker instance which is real now.

            const tracker = client.getCostTracker();
            vi.spyOn(tracker, 'getTodayCost').mockReturnValue(1.95);

            const context: TaskContext = {
                type: 'planning',
                complexity: 'high',
                isCritical: true,
                tokenBudgetRemaining: 0.05 // < $0.10 threshold (will be calculated from tracker)
            };

            const response = await client.chat('Complex task', { context });

            expect(response.model).toBe('fast-responder');
        });
    });

    describe('Prompt Caching', () => {
        it('should cache system prompt for Kimi', async () => {
            const context: TaskContext = {
                type: 'execution',
                complexity: 'medium',
                tokenBudgetRemaining: 2.00
            };

            // Mock first response (uncached)
            // @ts-ignore
            client.client.messages.create.mockResolvedValueOnce({
                content: [{ text: 'Response 1' }],
                usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0 }
            })
                // Mock second response (cached)
                // @ts-ignore
                .mockResolvedValueOnce({
                    content: [{ text: 'Response 2' }],
                    usage: { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 90 }
                });

            // First request
            const response1 = await client.chat('Task 1', {
                context,
                useCache: true
            });

            expect(response1.usage.cachedTokens).toBe(0);

            // Second request
            const response2 = await client.chat('Task 2', {
                context,
                useCache: true
            });

            expect(response2.usage.cachedTokens).toBeGreaterThan(0);
            expect(response2.usage.cost).toBeLessThan(response1.usage.cost);
        });
    });
});
