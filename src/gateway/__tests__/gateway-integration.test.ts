import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { GatewayServer } from '../gateway-server';

describe('Gateway Integration', () => {
    let gateway: GatewayServer;
    let ws: WebSocket;

    beforeAll(async () => {
        gateway = new GatewayServer({
            wsPort: 3100,
            httpPort: 3101,
            allowedOrigins: ['*'],
            maxConnections: 10
        });

        await gateway.start();
    });

    afterAll(async () => {
        await gateway.stop();
    });

    it('should connect via WebSocket', () => new Promise<void>((resolve) => {
        ws = new WebSocket('ws://localhost:3100');

        ws.on('open', () => {
            expect(ws.readyState).toBe(WebSocket.OPEN);
            resolve();
        });
    }));

    it('should handle chat message', () => new Promise<void>((resolve) => {
        ws.send(JSON.stringify({
            type: 'chat',
            content: 'Olá, Sara!'
        }));

        ws.on('message', (data) => {
            const response = JSON.parse(data.toString());

            // Ignore system welcome message
            if (response.type === 'system') return;

            expect(response.type).toBe('message');
            expect(response.content).toContain('Echo: Olá, Sara!');

            resolve();
        });
    }));

    it('should handle ping message', () => new Promise<void>((resolve) => {
        ws.send(JSON.stringify({
            type: 'ping',
            content: ''
        }));

        ws.on('message', (data) => {
            const response = JSON.parse(data.toString());

            // Ignore system welcome message or previous chat response
            if (response.content !== 'pong') return;

            expect(response.type).toBe('system');
            expect(response.content).toBe('pong');

            resolve();
        });
    }));
});
