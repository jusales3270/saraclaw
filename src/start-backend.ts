#!/usr/bin/env node
/**
 * Sara Backend Startup Script
 * 
 * Inicia o GatewayServer real com:
 * - WebSocket na porta 3000 (para o frontend chat)
 * - REST API na porta 3001 (para endpoints /api/*)
 */

import { GatewayServer } from './gateway/gateway-server.js';

const WS_PORT = parseInt(process.env.SARACLAW_GATEWAY_PORT || '3000', 10);
const HTTP_PORT = parseInt(process.env.SARACLAW_BRIDGE_PORT || '3001', 10);

async function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║     🧠 SARA - A Entidade Soberana    ║');
    console.log('║     Backend Gateway Starting...      ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    const gateway = new GatewayServer({
        wsPort: WS_PORT,
        httpPort: HTTP_PORT,
        allowedOrigins: [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
        ],
        maxConnections: 10,
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n[Sara] Shutting down gracefully...');
        await gateway.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        await gateway.start();
        console.log('');
        console.log(`[Sara] ✅ WebSocket server: ws://localhost:${WS_PORT}`);
        console.log(`[Sara] ✅ REST API server:  http://localhost:${HTTP_PORT}`);
        console.log(`[Sara] ✅ Frontend UI:      http://localhost:5173`);
        console.log('');
        console.log('[Sara] Backend pronto. Aguardando conexões...');
    } catch (error) {
        console.error('[Sara] ❌ Falha ao iniciar backend:', error);
        process.exit(1);
    }
}

main();
