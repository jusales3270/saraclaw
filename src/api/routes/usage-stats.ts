import express from 'express';
import { LLMClient } from '../../agents/llm/llm-client.js';

const router = express.Router();

/**
 * GET /api/usage/today
 * Get today's usage statistics
 */
router.get('/today', async (req, res) => {
    try {
        const llmClient = new LLMClient();
        const tracker = llmClient.getCostTracker();

        const today = new Date().toISOString().split('T')[0];
        const breakdown = tracker.getFeatureBreakdown(today);
        const modelComparison = tracker.getModelComparison(today);

        const totalCost = breakdown.reduce((sum, f) => sum + f.totalCost, 0);
        const totalRequests = breakdown.reduce((sum, f) => sum + f.requests, 0);

        const dailyLimit = parseFloat(process.env.SARA_DAILY_BUDGET_USD || '2.00');
        const remaining = dailyLimit - totalCost;

        res.json({
            date: today,
            budget: {
                limit: dailyLimit,
                spent: totalCost,
                remaining,
                percentage: (remaining / dailyLimit) * 100
            },
            summary: {
                totalRequests,
                totalCost,
                avgCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0
            },
            byFeature: breakdown,
            byModel: modelComparison
        });

    } catch (error: any) {
        console.error('[API] Error fetching usage stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/usage/monthly
 * Get monthly projection
 */
router.get('/monthly', async (req, res) => {
    try {
        const llmClient = new LLMClient();
        const tracker = llmClient.getCostTracker();

        const projection = tracker.getMonthlyProjection();
        const history = tracker.getMonthlyHistory();

        res.json({
            projection,
            history
        });

    } catch (error: any) {
        console.error('[API] Error fetching monthly stats:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
