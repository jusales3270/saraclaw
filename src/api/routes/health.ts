import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    // M7 FIX: Real health metrics
    const memory = process.memoryUsage();

    res.json({
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: {
            rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
        },
        // TODO: Add DB/LLM connection checks here
    });
});

export default router;
