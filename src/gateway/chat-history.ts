import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    model?: string;
    cost?: number;
    latency?: number;
    cached?: boolean;
  };
  createdAt: Date;
}

export interface Conversation {
  id: string;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export class ChatHistory {
  private db: Database.Database;

  constructor(dbPath = process.env.SARACLAW_CHAT_DB || './.saraclaw/chat-history.db') {
    // Ensure directory exists if path contains directory separators
    if (dbPath.includes('/') || dbPath.includes('\\')) {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  /**
   * Initialize database schema
   */
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_session_id ON conversations(session_id);
    `);
  }

  /**
   * Create new conversation
   */
  createConversation(sessionId: string): string {
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO conversations (id, session_id)
      VALUES (?, ?)
    `).run(id, sessionId);

    console.log(`[ChatHistory] Created conversation ${id} for session ${sessionId}`);

    return id;
  }

  /**
   * Get or create conversation for session
   */
  getOrCreateConversation(sessionId: string): string {
    // Try to find existing conversation
    const existing = this.db.prepare(`
      SELECT id FROM conversations
      WHERE session_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(sessionId) as { id: string } | undefined;

    if (existing) {
      return existing.id;
    }

    // Create new one
    return this.createConversation(sessionId);
  }

  /**
   * Add message to conversation
   */
  addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: ChatMessage['metadata']
  ): string {
    const id = this.generateMessageId();

    this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      conversationId,
      role,
      content,
      metadata ? JSON.stringify(metadata) : null
    );

    // Update conversation timestamp
    this.db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(conversationId);

    return id;
  }

  /**
   * Get conversation history (last N messages)
   */
  getHistory(conversationId: string, limit = 10): ChatMessage[] {
    const messages = this.db.prepare(`
      SELECT 
        id,
        conversation_id,
        role,
        content,
        metadata,
        created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(conversationId, limit) as any[];

    // Reverse to get chronological order
    return messages.reverse().map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      metadata: m.metadata ? JSON.parse(m.metadata) : undefined,
      createdAt: new Date(m.created_at)
    }));
  }

  /**
   * Get conversation info
   */
  getConversation(conversationId: string): Conversation | null {
    const conv = this.db.prepare(`
      SELECT 
        c.id,
        c.session_id,
        c.created_at,
        c.updated_at,
        COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.id = ?
      GROUP BY c.id
    `).get(conversationId) as any;

    if (!conv) return null;

    return {
      id: conv.id,
      sessionId: conv.session_id,
      createdAt: new Date(conv.created_at),
      updatedAt: new Date(conv.updated_at),
      messageCount: conv.message_count
    };
  }

  /**
   * Search messages by content
   */
  searchMessages(query: string, limit = 20): ChatMessage[] {
    const messages = this.db.prepare(`
      SELECT 
        id,
        conversation_id,
        role,
        content,
        metadata,
        created_at
      FROM messages
      WHERE content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(`%${query}%`, limit) as any[];

    return messages.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      metadata: m.metadata ? JSON.parse(m.metadata) : undefined,
      createdAt: new Date(m.created_at)
    }));
  }

  /**
   * Delete conversation and all messages
   */
  deleteConversation(conversationId: string): void {
    const info = this.db.prepare(`
      DELETE FROM conversations WHERE id = ?
    `).run(conversationId);

    console.log(`[ChatHistory] Deleted conversation ${conversationId} (${info.changes} affected)`);
  }

  /**
   * Get total message count across all conversations
   */
  getTotalMessageCount(): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages
    `).get() as { count: number };

    return result.count;
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(m.id) as total_messages,
        AVG(msg_count.count) as avg_messages_per_conversation,
        SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) as user_messages,
        SUM(CASE WHEN m.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      LEFT JOIN (
        SELECT conversation_id, COUNT(*) as count
        FROM messages
        GROUP BY conversation_id
      ) msg_count ON msg_count.conversation_id = c.id
    `).get() as any;

    return {
      totalConversations: stats.total_conversations || 0,
      totalMessages: stats.total_messages || 0,
      avgMessagesPerConversation: stats.avg_messages_per_conversation || 0,
      userMessages: stats.user_messages || 0,
      assistantMessages: stats.assistant_messages || 0
    };
  }

  /**
   * Generate unique message ID
   */
  generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
