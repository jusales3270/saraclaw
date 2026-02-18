import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../message-router.js';
import { Session } from '../session-manager.js';

// Mock better-sqlite3 globally to prevent native module issues
vi.mock('better-sqlite3', () => ({
    default: vi.fn(() => ({
        exec: vi.fn(),
        prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })),
        close: vi.fn()
    }))
}));

// Mocks
const mockChatHistory = {
    getOrCreateConversation: vi.fn(),
    getHistory: vi.fn(),
    addMessage: vi.fn(),
    getConversation: vi.fn(),
    searchMessages: vi.fn(),
    deleteConversation: vi.fn()
};

const mockEcho = {
    process: vi.fn()
};

const mockContextBridge = {
    getUserContext: vi.fn()
};

const mockCommandHandler = {
    execute: vi.fn()
};

const mockCensor = {
    // Methods if any called
};

// Mock modules
vi.mock('../chat-history.js', () => {
    return {
        ChatHistory: class {
            constructor() {
                return mockChatHistory;
            }
        }
    };
});

vi.mock('../echo.js', () => ({
    Echo: class {
        process = mockEcho.process;
    }
}));

vi.mock('../context-bridge.js', () => ({
    ContextBridge: class {
        getUserContext = mockContextBridge.getUserContext;
    }
}));

vi.mock('../command-handler.js', () => ({
    CommandHandler: class {
        execute = mockCommandHandler.execute;
    }
}));

vi.mock('../../shield/the-censor.js', () => ({
    TheCensor: class {
        // methods
    }
}));

describe('MessageRouter', () => {
    let router: MessageRouter;
    let session: Session;

    beforeEach(() => {
        vi.clearAllMocks();
        router = new MessageRouter();
        session = {
            id: 'session-1',
            userId: 'user-1',
            createdAt: new Date(),
            lastActivity: new Date(),
            metadata: {},
            ws: null as any,
            clientIp: '127.0.0.1'
        };
    });

    it('should handle ping', async () => {
        const result = await router.route(session, { type: 'ping', content: '' });
        expect(result).toEqual({ type: 'system', content: 'pong' });
    });

    it('should handle command', async () => {
        mockCommandHandler.execute.mockResolvedValue('Command output');

        const result = await router.route(session, { type: 'command', content: '/test' });

        expect(mockCommandHandler.execute).toHaveBeenCalledWith('/test', session);
        expect(result).toEqual({ type: 'system', content: 'Command output' });
    });

    it('should handle chat message', async () => {
        const conversationId = 'conv-123';
        mockChatHistory.getOrCreateConversation.mockReturnValue(conversationId);
        mockChatHistory.getHistory.mockReturnValue([]);
        mockContextBridge.getUserContext.mockResolvedValue({});

        mockEcho.process.mockResolvedValue({
            content: 'Echo response',
            processingTimeMs: 100
        });

        // Setup addMessage return values
        mockChatHistory.addMessage
            .mockReturnValueOnce('msg-user-1') // User msg
            .mockReturnValueOnce('msg-assistant-1'); // Assistant msg

        const result = await router.route(session, { type: 'chat', content: 'Hello' });

        expect(mockChatHistory.getOrCreateConversation).toHaveBeenCalledWith(session.id);
        expect(session.metadata.conversationId).toBe(conversationId);

        expect(mockContextBridge.getUserContext).toHaveBeenCalled();
        expect(mockEcho.process).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Hello'
        }));

        expect(mockChatHistory.addMessage).toHaveBeenCalledTimes(2);

        expect(result).toEqual({
            type: 'message',
            content: 'Echo response',
            messageId: 'msg-assistant-1',
            metadata: expect.objectContaining({
                latency: 100
            })
        });
    });
});
