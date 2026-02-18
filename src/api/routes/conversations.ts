import express from 'express';
import { ChatHistory } from '../../gateway/chat-history.js';

import { Router } from 'express';

const router: Router = express.Router();
const chatHistory = new ChatHistory();

/**
 * GET /api/conversations
 * List all conversations
 */
router.get('/', (req, res) => {
    try {
        const stats = chatHistory.getStats();

        res.json({
            summary: stats,
            // TODO: Add list of conversations with pagination
        });

    } catch (error: any) {
        console.error('[API] Error fetching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/conversations/search
 * Search messages
 * NOTE: Must be declared BEFORE /:id to avoid "search" matching as :id
 */
router.get('/search', (req, res) => {
    try {
        const { q, limit = '20' } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const results = chatHistory.searchMessages(q as string, parseInt(limit as string));

        res.json({
            query: q,
            results
        });

    } catch (error: any) {
        console.error('[API] Error searching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/conversations/:id
 * Get conversation details
 */
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { limit = '50' } = req.query;

        const conversation = chatHistory.getConversation(id);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const history = chatHistory.getHistory(id, parseInt(limit as string));

        res.json({
            conversation,
            messages: history
        });

    } catch (error: any) {
        console.error('[API] Error fetching conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/conversations/:id
 * Delete conversation
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        chatHistory.deleteConversation(id);

        res.json({ message: 'Conversation deleted' });

    } catch (error: any) {
        console.error('[API] Error deleting conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/conversations/search
 * Search messages
 */
router.get('/search', (req, res) => {
    try {
        const { q, limit = '20' } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const results = chatHistory.searchMessages(q as string, parseInt(limit as string));

        res.json({
            query: q,
            results
        });

    } catch (error: any) {
        console.error('[API] Error searching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
