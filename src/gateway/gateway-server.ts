import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { MessageRouter } from './message-router.js';
import { SessionManager } from './session-manager.js';
import { RestServer } from '../api/rest-server.js';
import { createServer, Server } from 'http';

export interface GatewayConfig {
    wsPort: number;              // WebSocket port
    httpPort: number;            // REST API port
    allowedOrigins: string[];    // CORS
    maxConnections: number;      // Rate limiting
}

export class GatewayServer {
    private wss!: WebSocketServer;
    private httpServer?: Server;
    private expressApp?: express.Application;
    private messageRouter: MessageRouter;
    private sessionManager: SessionManager;
    private restServer: RestServer;

    constructor(private config: GatewayConfig) {
        this.messageRouter = new MessageRouter();
        this.sessionManager = new SessionManager();
        this.restServer = new RestServer();
    }

    /**
     * Start both WebSocket and HTTP servers
     */
    async start() {
        // 1. Start WebSocket server
        await this.startWebSocketServer();

        // 2. Start REST API server
        await this.startRestServer();

        console.log(`[Gateway] WebSocket listening on :${this.config.wsPort}`);
        console.log(`[Gateway] REST API listening on :${this.config.httpPort}`);
    }

    /**
     * WebSocket server for real-time communication
     */
    private async startWebSocketServer() {
        this.wss = new WebSocketServer({
            port: this.config.wsPort,
            maxPayload: 10 * 1024 * 1024 // 10MB max message
        });

        this.wss.on('connection', (ws: WebSocket, req) => {
            this.handleConnection(ws, req);
        });

        // Heartbeat to detect dead connections
        setInterval(() => {
            this.wss.clients.forEach((ws: any) => {
                if (ws.isAlive === false) {
                    console.log('[Gateway] Terminating dead connection');
                    return ws.terminate();
                }

                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // 30s
    }

    /**
     * Handle new WebSocket connection
     */
    private async handleConnection(ws: WebSocket, req: any) {
        const clientIp = req.socket.remoteAddress;

        console.log(`[Gateway] New connection from ${clientIp}`);

        // Check rate limiting
        if (!this.sessionManager.canConnect(clientIp)) {
            ws.close(1008, 'Too many connections');
            return;
        }

        // Create session
        const session = await this.sessionManager.createSession(ws, clientIp);

        // Setup handlers
        ws.on('message', async (data: Buffer) => {
            await this.handleMessage(session.id, data);
        });

        ws.on('pong', () => {
            (ws as any).isAlive = true;
        });

        ws.on('close', () => {
            this.sessionManager.destroySession(session.id);
            console.log(`[Gateway] Session ${session.id} closed`);
        });

        ws.on('error', (error) => {
            console.error(`[Gateway] WebSocket error:`, error);
            this.sessionManager.destroySession(session.id);
        });

        // Send welcome message
        this.sendToClient(ws, {
            type: 'system',
            content: 'Connected to Sara',
            sessionId: session.id
        });
    }

    /**
     * Handle incoming message from client
     */
    private async handleMessage(sessionId: string, data: Buffer) {
        const session = this.sessionManager.getSession(sessionId);

        if (!session) {
            console.error(`[Gateway] Session ${sessionId} not found`);
            return;
        }

        try {
            // Parse message
            const message = JSON.parse(data.toString());

            console.log(`[Gateway] Received:`, {
                session: sessionId,
                type: message.type,
                length: data.length
            });

            // Route to appropriate handler
            const response = await this.messageRouter.route(session, message);

            // Send response back
            if (response) {
                this.sendToClient(session.ws, response);
            }

        } catch (error: any) {
            console.error('[Gateway] Message handling error:', error);

            this.sendToClient(session.ws, {
                type: 'error',
                content: 'Failed to process message',
                error: error.message
            });
        }
    }

    /**
     * Send message to client
     */
    private sendToClient(ws: WebSocket, data: any) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    /**
     * Broadcast to all connected clients (for Whisper)
     */
    broadcastToAll(message: any) {
        this.wss.clients.forEach((ws) => {
            this.sendToClient(ws, message);
        });
    }

    /**
     * Start REST API server
     */
    private async startRestServer() {
        const app = this.restServer.createApp();
        this.httpServer = createServer(app);

        return new Promise<void>((resolve) => {
            this.httpServer!.listen(this.config.httpPort, () => {
                console.log(`[REST] Server started on port ${this.config.httpPort}`);
                resolve();
            });
        });
    }

    /**
     * Graceful shutdown
     */
    async stop() {
        console.log('[Gateway] Shutting down...');

        // Close all WebSocket connections
        if (this.wss) {
            this.wss.clients.forEach((ws) => {
                ws.close(1001, 'Server shutting down');
            });

            this.wss.close();
        }

        // Close HTTP server
        if (this.httpServer) {
            await new Promise<void>((resolve, reject) => {
                this.httpServer!.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        console.log('[Gateway] Shutdown complete');
    }
}
