import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

export interface Session {
    id: string;
    ws: WebSocket;
    clientIp: string;
    userId?: string;             // After auth (optional for MVP)
    createdAt: Date;
    lastActivity: Date;
    metadata: {
        userAgent?: string;
        conversationId?: string;   // Link to chat history
    };
}

export class SessionManager {
    private sessions = new Map<string, Session>();
    private connectionCounts = new Map<string, number>();

    /**
     * Rate limiting: Max 3 connections per IP
     */
    canConnect(clientIp: string): boolean {
        const count = this.connectionCounts.get(clientIp) || 0;
        return count < 3;
    }

    /**
     * Create new session
     */
    async createSession(ws: WebSocket, clientIp: string): Promise<Session> {
        const sessionId = uuidv4();

        const session: Session = {
            id: sessionId,
            ws,
            clientIp,
            createdAt: new Date(),
            lastActivity: new Date(),
            metadata: {}
        };

        this.sessions.set(sessionId, session);

        // Update connection count
        const count = this.connectionCounts.get(clientIp) || 0;
        this.connectionCounts.set(clientIp, count + 1);

        return session;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): Session | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Update last activity timestamp
     */
    touchSession(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
        }
    }

    /**
     * Destroy session
     */
    destroySession(sessionId: string) {
        const session = this.sessions.get(sessionId);

        if (session) {
            // Decrease connection count
            const count = this.connectionCounts.get(session.clientIp) || 1;
            this.connectionCounts.set(session.clientIp, count - 1);

            this.sessions.delete(sessionId);
        }
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): Session[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Clean up stale sessions (>1h inactive)
     */
    cleanupStaleSessions() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        for (const [id, session] of this.sessions.entries()) {
            if (session.lastActivity < oneHourAgo) {
                console.log(`[SessionManager] Cleaning up stale session: ${id}`);
                session.ws.close(1000, 'Session timeout');
                this.destroySession(id);
            }
        }
    }
}
