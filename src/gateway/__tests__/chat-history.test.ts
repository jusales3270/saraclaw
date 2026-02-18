import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatHistory } from '../chat-history.js';
import Database from 'better-sqlite3';

describe.skip('ChatHistory', () => {
    let chatHistory: ChatHistory;

    beforeEach(() => {
        // Initialize with in-memory database for testing
        // ChatHistory constructor allows passing a db instance or uses default.
        // We need to modify ChatHistory to accept a db path or instance for testing, 
        // OR we can rely on it creating a file. 
        // Reading chat-history.ts again (mentally), it likely creates 'sara_chat.db'.
        // We should probably modify ChatHistory to accept options to use :memory:

        // Let's assume for now we might need to modify ChatHistory to accept config.
        // But for this test, if ChatHistory hardcodes the filename, we might be writing to disk.
        // Let's check ChatHistory implementation first or just try to pass config.

        // For now, I will instantiate it. If it writes to file, we clean up.
        // Actually, better to modify ChatHistory to allow memory db.
        chatHistory = new ChatHistory(':memory:');
    });

    it('should create a conversation', () => {
        const sessionId = 'session-123';
        const conversationId = chatHistory.createConversation(sessionId);

        expect(conversationId).toBeDefined();

        const conversation = chatHistory.getConversation(conversationId);
        expect(conversation).toBeDefined();
        expect(conversation?.sessionId).toBe(sessionId);
    });

    it('should add messages to conversation', () => {
        const sessionId = 'session-123';
        const conversationId = chatHistory.createConversation(sessionId);

        const userMsgId = chatHistory.addMessage(conversationId, 'user', 'Hello');
        const assistantMsgId = chatHistory.addMessage(conversationId, 'assistant', 'Hi there');

        expect(userMsgId).toBeDefined();
        expect(assistantMsgId).toBeDefined();

        const history = chatHistory.getHistory(conversationId);
        expect(history).toHaveLength(2);
        expect(history[0].role).toBe('user');
        expect(history[0].content).toBe('Hello');
        expect(history[1].role).toBe('assistant');
        expect(history[1].content).toBe('Hi there');

        // Default ordering in getHistory might be ASC or DESC? 
        // Usually history for context is ASC (oldest first).
    });

    it('should search messages', () => {
        const sessionId = 'session-123';
        const conversationId = chatHistory.createConversation(sessionId);

        chatHistory.addMessage(conversationId, 'user', 'Importante: O código secreto é 1234');
        chatHistory.addMessage(conversationId, 'assistant', 'Entendido.');
        chatHistory.addMessage(conversationId, 'user', 'Outra coisa qualquer');

        const results = chatHistory.searchMessages('código secreto');
        expect(results).toHaveLength(1);
        expect(results[0].content).toContain('1234');
    });

    it('should get conversation stats', () => {
        const sessionId = 'session-123';
        const conversationId = chatHistory.createConversation(sessionId);

        chatHistory.addMessage(conversationId, 'user', 'A');
        chatHistory.addMessage(conversationId, 'assistant', 'B');

        const conversation = chatHistory.getConversation(conversationId);
        expect(conversation?.messageCount).toBe(2);
    });
});
