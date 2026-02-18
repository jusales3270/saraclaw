import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TheEcho } from '../echo.js';
import { TheWhisper } from '../whisper.js';
import { LLMClient } from '../../agents/llm/llm-client.js';
import { OpenAugiReader } from '../../../packages/sara-memory/src/reader.js';

// Mock dependencies
vi.mock('../../agents/llm/llm-client.js');
vi.mock('../../../packages/sara-memory/src/reader.js');
vi.mock('../../../packages/sara-memory/src/writer.js');

describe('TheEcho', () => {
    let echo: TheEcho;
    let mockLlmClient: any;

    beforeEach(() => {
        // Mock LLM Client
        const LLMClientMock = vi.mocked(LLMClient);
        mockLlmClient = {
            chat: vi.fn().mockResolvedValue({
                content: 'Echo response',
                model: 'mock-model',
                usage: { inputTokens: 10, outputTokens: 5, cost: 0.001 },
                metadata: { latency: 100, cached: false }
            })
        };
        // @ts-ignore
        echo = new TheEcho(mockLlmClient);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should respond to simple message', async () => {
        const response = await echo.respond('Olá!', {
            context: {
                type: 'chat',
                complexity: 'low',
                feature: 'echo'
            } as any
        });

        expect(response.content).toBe('Echo response');
        expect(mockLlmClient.chat).toHaveBeenCalled();
    });
});

describe('TheWhisper', () => {
    let whisper: TheWhisper;
    let mockLlmClient: any;
    let mockOpenAugi: any;

    beforeEach(() => {
        mockLlmClient = {
            chat: vi.fn().mockResolvedValue({
                content: '{"insights": [{"content": "Test insight", "category": "urgent", "actionable": true}]}',
                model: 'mock-model',
                usage: { inputTokens: 10, outputTokens: 5, cost: 0.001 },
                metadata: { latency: 100, cached: false }
            })
        };
        mockOpenAugi = {};

        // Mock score response
        mockLlmClient.chat.mockResolvedValueOnce({
            content: '{"insights": [{"content": "Test insight", "category": "urgent", "actionable": true}]}',
            model: 'mock-model',
            usage: {}, metadata: {}
        }).mockResolvedValueOnce({
            content: '9', // Score 9
            model: 'mock-model',
            usage: {}, metadata: {}
        });

        // @ts-ignore
        whisper = new TheWhisper(mockLlmClient, mockOpenAugi);
    });

    it('should process research results', async () => {
        const insights = await whisper.processResearchResults(
            'Test Topic',
            ['Finding 1'],
            {}
        );

        expect(insights.length).toBeGreaterThan(0);
        expect(insights[0].score).toBe(9);
    });

    it('should queue high-score notifications', async () => {
        // Mock score > 9
        mockLlmClient.chat.mockResolvedValueOnce({
            content: '{"insights": [{"content": "Critical update", "category": "urgent"}]}',
            model: 'mock-model',
            usage: {}, metadata: {}
        }).mockResolvedValueOnce({
            content: '10',
            model: 'mock-model',
            usage: {}, metadata: {}
        });

        await whisper.processResearchResults('Critical', ['Alert'], {});
        const notifications = whisper.getPendingNotifications();
        expect(notifications.length).toBe(1);
    });
});
