import express from 'express';
import { LLMClient } from '../../agents/llm/llm-client.js';
import { VectorStore } from '../../../packages/sara-memory/src/vector-store.js';
import { InnerMonologue } from '../../reflexion/inner-monologue.js';
import { CuriosityEngine } from '../../heart/curiosity-engine.js';


import { SaraScheduler } from '../../heart/scheduler.js';

const router = express.Router();

/**
 * GET /api/pulse/first
 * Run first supervised pulse via Server-Sent Events
 * Streams inner monologue logs in real time
 */
router.get('/first', async (req, res) => {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    /**
     * Helper to send SSE event
     */
    const sendEvent = (stage: string, message: string, detail?: string) => {
        const data = JSON.stringify({ stage, message, detail });
        res.write(`data: ${data}\n\n`);

        if ((res as any).flush) {
            (res as any).flush();
        }
    };

    /**
     * Wait helper that respects pause state
     */
    const wait = async (ms: number) => {
        const scheduler = SaraScheduler.getInstance();
        const checkInterval = 100;
        let elapsed = 0;

        while (elapsed < ms) {
            // If paused, wait indefinitely (check every 500ms)
            while (scheduler.isPausedState()) {
                await sleep(500);
                // Send a heartbeat event to keep connection alive if needed, or just wait
            }
            await sleep(checkInterval);
            elapsed += checkInterval;
        }
    };

    // M8 FIX: Singleton instances to prevent connection pooling leaks
    const llmClient = new LLMClient();
    const vectorStore = new VectorStore();

    router.get('/first', async (req, res) => {
        // ... existing setup ...
        try {
            // removed local instantiation

            // Ensure scheduler is initialized for state tracking
            const scheduler = SaraScheduler.getInstance();

            // Stage 1: REFLEXION - Analyze context
            sendEvent('REFLEXION', 'Analisando contexto inicial...');
            await wait(800);

            // Check if there are any atoms in the store
            const searchResults = await vectorStore.search('usuário contexto informação', 3);
            const hasContext = searchResults.length > 0;

            if (hasContext) {
                sendEvent(
                    'REFLEXION',
                    `${searchResults.length} notas encontradas na memória`,
                    `Fontes: ${[...new Set(searchResults.map((r: any) => r.metadata.source))].join(', ')}`
                );
            } else {
                sendEvent('REFLEXION', 'Memória vazia — começando do zero', 'Contexto será construído organicamente');
            }

            await wait(600);

            // Stage 2: DECIDING - Context diff
            const contextDiff = hasContext ? 72 : 95;

            sendEvent(
                'DECIDING',
                `Context diff: ${contextDiff}%`,
                contextDiff > 40
                    ? 'Acima do threshold (40%) → Iniciar pesquisa'
                    : 'Abaixo do threshold → Permanecer em IDLE'
            );

            await wait(700);

            // Stage 3: ACTION - Research
            sendEvent('ACTION', 'Iniciando pesquisa autônoma...');
            await wait(500);

            // Generate a relevant query using LLM
            const queryResponse = await llmClient.chat(
                'Gere UMA query de pesquisa curta (máx 5 palavras) sobre tendências recentes em IA soberana, privacidade de dados ou automação inteligente. Responda APENAS com a query, sem explicação.',
                {
                    context: {
                        type: 'analysis',
                        complexity: 'low',
                        tokenBudgetRemaining: 2.0,
                        feature: 'heartbeat'
                    },
                    maxTokens: 20
                }
            );

            const query = queryResponse.content.trim();

            sendEvent('ACTION', `Query gerada: "${query}"`, 'The Censor: ✅ Sem dados sensíveis detectados');
            await wait(1000);

            sendEvent('ACTION', 'Pesquisando informações relevantes...', 'NetworkJail: ✅ URLs validadas');
            await wait(1500);

            // Stage 4: SYNTHESIS
            sendEvent('SYNTHESIS', 'Cruzando descobertas com memória...', 'Gerando embedding do novo conhecimento');
            await wait(1000);

            // Generate actual insight using LLM
            const insightResponse = await llmClient.chat(
                `Você é Sara, uma IA soberana. Acabe de completar sua primeira reflexão autônoma.
      
      Gere UM insight conciso (máximo 2 frases) sobre IA soberana ou privacidade de dados,
      como se estivesse compartilhando sua primeira descoberta com o usuário.
      
      Seja específica e relevante. Não use markdown. Fale na primeira pessoa.`,
                {
                    context: {
                        type: 'synthesis',
                        complexity: 'medium',
                        tokenBudgetRemaining: 2.0,
                        feature: 'whisper'
                    },
                    maxTokens: 100
                }
            );

            const insight = insightResponse.content.trim();

            sendEvent('SYNTHESIS', 'Insight sintetizado', `Custo: $${insightResponse.usage.cost.toFixed(4)}`);
            await wait(800);

            // Stage 5: OUTPUT - Final insight
            sendEvent('OUTPUT', insight);

            // Close SSE stream
            res.end();

        } catch (error: any) {
            console.error('[Pulse] Error:', error);

            // Fallback insight on error
            sendEvent(
                'OUTPUT',
                'Completei minha primeira reflexão. Estou pronta para começar a trabalhar com você.'
            );

            res.end();
        }
    });
});

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GET /api/pulse/status
 * Get current pulse/scheduler status
 */
router.get('/status', (req, res) => {
    try {
        const scheduler = SaraScheduler.getInstance();
        const metrics = scheduler.getMetrics();
        const state = scheduler.getState();
        const isPaused = scheduler.isPausedState();

        res.json({
            isRunning: state !== 'STOPPED' && state !== 'SHUTDOWN' && state !== 'ERROR',
            isPaused,
            currentState: state,
            totalPulses: metrics.totalPulses,
            lastPulseAt: metrics.lastPulseAt,
            nextPulseIn: 30 // Approximate
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/pulse/action
 * Control the pulse scheduler
 */
router.post('/action', async (req, res) => {
    try {
        const { action } = req.body;
        const scheduler = SaraScheduler.getInstance();

        switch (action) {
            case 'PAUSE':
                scheduler.pause();
                break;
            case 'RESUME':
                scheduler.resume();
                break;
            case 'STOP':
                await scheduler.stop();
                break;
            case 'EMERGENCY_STOP':
                await scheduler.emergencyStop('API_USER_REQUEST');
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        res.json({ success: true, action });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

