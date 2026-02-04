/**
 * Sara Gateway - Context Bridge
 * 
 * Bridges chat messages with OpenAugi memory.
 * Converts conversations into "memory atoms" for persistent storage.
 * 
 * This enables Sara to integrate:
 * - What was said in Telegram
 * - What she learned during research
 * - What she wrote in her diary
 * 
 * Into a unified context for future reflections.
 */

import { JournalWriter, createJournalWriter, JournalEntry } from '../../packages/sara-memory/src/writer.js';
import { IncomingMessage, OutgoingResponse, ChannelType } from './echo.js';

// ============================================
// TYPES
// ============================================

/** Memory atom - smallest unit of conversational memory */
export interface MemoryAtom {
    /** Unique ID */
    id: string;

    /** Source channel */
    channel: ChannelType;

    /** Atom type */
    type: 'user_message' | 'sara_response' | 'conversation_summary' | 'topic_insight';

    /** User who created/triggered this */
    userId?: string;

    /** Content of the atom */
    content: string;

    /** Extracted topics/keywords */
    topics: string[];

    /** Importance score (0-1) */
    importance: number;

    /** Related atoms (for threading) */
    relatedAtoms?: string[];

    /** Raw message ID (for linking) */
    sourceMessageId?: string;

    /** Timestamp */
    timestamp: Date;
}

/** Conversation summary */
export interface ConversationSummary {
    /** Conversation ID */
    conversationId: string;

    /** Channel */
    channel: ChannelType;

    /** Participant IDs */
    participants: string[];

    /** Start time */
    startedAt: Date;

    /** End time */
    endedAt: Date;

    /** Number of messages */
    messageCount: number;

    /** Main topics discussed */
    topics: string[];

    /** Key takeaways */
    takeaways: string[];

    /** Follow-up items */
    followUps?: string[];

    /** Sentiment (overall) */
    sentiment: 'positive' | 'neutral' | 'negative';
}

/** Context Bridge configuration */
export interface ContextBridgeConfig {
    /** OpenAugi path */
    openAugiPath: string;

    /** Auto-summarize after N messages */
    autoSummarizeThreshold: number;

    /** Topic extraction enabled */
    extractTopics: boolean;

    /** Dry run mode */
    dryRun: boolean;

    /** Verbose logging */
    verbose: boolean;
}

/** Default configuration */
const DEFAULT_BRIDGE_CONFIG: ContextBridgeConfig = {
    openAugiPath: './tests/sample-openaugi',
    autoSummarizeThreshold: 10,
    extractTopics: true,
    dryRun: true,
    verbose: true,
};

// ============================================
// CONTEXT BRIDGE
// ============================================

/**
 * Context Bridge - Chat to Memory Converter
 * 
 * Captures conversational context and persists it to OpenAugi.
 */
export class ContextBridge {
    private config: ContextBridgeConfig;
    private journalWriter: JournalWriter;
    private memoryBuffer: MemoryAtom[] = [];
    private conversationCache: Map<string, MemoryAtom[]> = new Map();
    private atomsCreated: number = 0;
    private summariesCreated: number = 0;

    constructor(config: Partial<ContextBridgeConfig> = {}) {
        this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
        this.journalWriter = createJournalWriter({
            openAugiPath: this.config.openAugiPath,
            dryRun: this.config.dryRun,
            verbose: false, // Don't double-log
        });
    }

    /**
     * Convert incoming message to memory atom
     */
    captureIncoming(message: IncomingMessage): MemoryAtom {
        const atom: MemoryAtom = {
            id: `atom-${Date.now()}-${message.id}`,
            channel: message.channel,
            type: 'user_message',
            userId: message.userId,
            content: message.content,
            topics: this.config.extractTopics ? this.extractTopics(message.content) : [],
            importance: this.calculateImportance(message.content),
            sourceMessageId: message.id,
            timestamp: message.timestamp,
        };

        this.addToBuffer(atom, message.channelId);
        this.atomsCreated++;

        this.log(`📥 Captured user message: ${message.content.slice(0, 50)}...`);
        this.log(`   Topics: ${atom.topics.join(', ') || 'none'}`);

        return atom;
    }

    /**
     * Convert outgoing response to memory atom
     */
    captureOutgoing(response: OutgoingResponse, originalMessage: IncomingMessage): MemoryAtom {
        const atom: MemoryAtom = {
            id: `atom-${Date.now()}-resp-${response.inReplyTo}`,
            channel: response.channel,
            type: 'sara_response',
            content: response.content,
            topics: this.config.extractTopics ? this.extractTopics(response.content) : [],
            importance: 0.5, // Sara's responses are medium importance by default
            relatedAtoms: [originalMessage.id],
            sourceMessageId: response.inReplyTo,
            timestamp: response.timestamp,
        };

        this.addToBuffer(atom, response.channelId);
        this.atomsCreated++;

        this.log(`📤 Captured Sara response: ${response.content.slice(0, 50)}...`);

        // Check if we should auto-summarize
        const conversationAtoms = this.conversationCache.get(response.channelId) || [];
        if (conversationAtoms.length >= this.config.autoSummarizeThreshold) {
            this.log(`   ⚡ Threshold reached, auto-summarizing...`);
            this.summarizeConversation(response.channelId);
        }

        return atom;
    }

    /**
     * Add atom to buffer and conversation cache
     */
    private addToBuffer(atom: MemoryAtom, conversationId: string): void {
        this.memoryBuffer.push(atom);

        const existing = this.conversationCache.get(conversationId) || [];
        existing.push(atom);
        this.conversationCache.set(conversationId, existing);
    }

    /**
     * Extract topics from content
     */
    private extractTopics(content: string): string[] {
        const topics: string[] = [];
        const words = content.toLowerCase().split(/\s+/);

        // Topic keywords (simplified - in production use NLP)
        const topicPatterns: Record<string, string[]> = {
            'tecnologia': ['tech', 'software', 'hardware', 'api', 'código', 'programação'],
            'ia': ['ia', 'ai', 'inteligência', 'modelo', 'llm', 'gpt', 'gemini'],
            'segurança': ['segurança', 'seguro', 'privacidade', 'criptografia', 'senha'],
            'soberania': ['soberania', 'independência', 'autonomia', 'local'],
            'trabalho': ['trabalho', 'projeto', 'tarefa', 'deadline', 'prazo'],
            'pessoal': ['saúde', 'família', 'casa', 'vida', 'pessoal'],
        };

        for (const [topic, patterns] of Object.entries(topicPatterns)) {
            if (patterns.some(p => words.includes(p) || content.toLowerCase().includes(p))) {
                topics.push(topic);
            }
        }

        return topics;
    }

    /**
     * Calculate importance of content (0-1)
     */
    private calculateImportance(content: string): number {
        let score = 0.5; // Base score

        // Questions are more important
        if (content.includes('?')) score += 0.1;

        // Urgency markers
        if (/urgent|asap|importante|prioridade/i.test(content)) score += 0.2;

        // Action items
        if (/preciso|quero|faça|fazer|poderia/i.test(content)) score += 0.1;

        // Length (longer = potentially more important)
        if (content.length > 200) score += 0.1;

        return Math.min(1, score);
    }

    /**
     * Summarize a conversation and save to journal
     */
    summarizeConversation(conversationId: string): ConversationSummary | null {
        const atoms = this.conversationCache.get(conversationId);

        if (!atoms || atoms.length < 2) {
            return null;
        }

        // Build summary
        const userMessages = atoms.filter(a => a.type === 'user_message');
        const saraResponses = atoms.filter(a => a.type === 'sara_response');

        // Collect all topics
        const allTopics = new Set<string>();
        for (const atom of atoms) {
            for (const topic of atom.topics) {
                allTopics.add(topic);
            }
        }

        const summary: ConversationSummary = {
            conversationId,
            channel: atoms[0].channel,
            participants: [...new Set(atoms.filter(a => a.userId).map(a => a.userId!))],
            startedAt: atoms[0].timestamp,
            endedAt: atoms[atoms.length - 1].timestamp,
            messageCount: atoms.length,
            topics: Array.from(allTopics),
            takeaways: this.extractTakeaways(atoms),
            sentiment: 'neutral', // Simplified
        };

        // Write to journal
        const journalPath = this.writeConversationToJournal(summary, atoms);
        if (journalPath) {
            this.summariesCreated++;
            this.log(`📓 Conversation summary saved: ${journalPath}`);
        }

        // Clear this conversation from cache
        this.conversationCache.delete(conversationId);

        return summary;
    }

    /**
     * Extract takeaways from conversation atoms
     */
    private extractTakeaways(atoms: MemoryAtom[]): string[] {
        const takeaways: string[] = [];

        // Find high-importance messages
        const important = atoms.filter(a => a.importance > 0.6);
        for (const atom of important.slice(0, 3)) {
            takeaways.push(atom.content.slice(0, 100));
        }

        return takeaways;
    }

    /**
     * Write conversation summary to journal
     */
    private writeConversationToJournal(
        summary: ConversationSummary,
        atoms: MemoryAtom[]
    ): string | null {
        const content = this.formatConversationContent(summary, atoms);

        return this.journalWriter.write({
            type: 'reflection',
            title: `Conversa: ${summary.topics.slice(0, 3).join(', ') || 'Geral'}`,
            content,
            insights: summary.takeaways,
            pulseMode: 'idle',
            confidence: 0.6,
        });
    }

    /**
     * Format conversation content for journal
     */
    private formatConversationContent(
        summary: ConversationSummary,
        atoms: MemoryAtom[]
    ): string {
        const lines = [
            `## Conversa via ${summary.channel.toUpperCase()}`,
            '',
            `**Duração**: ${this.formatDuration(summary.startedAt, summary.endedAt)}`,
            `**Mensagens**: ${summary.messageCount}`,
            `**Tópicos**: ${summary.topics.join(', ') || 'diversos'}`,
            '',
            '### Resumo',
            '',
        ];

        // Add key exchanges
        const userMsgs = atoms.filter(a => a.type === 'user_message');
        if (userMsgs.length > 0) {
            lines.push('**Usuário perguntou/disse:**');
            for (const msg of userMsgs.slice(0, 3)) {
                lines.push(`- "${msg.content.slice(0, 80)}..."`);
            }
            lines.push('');
        }

        lines.push('**Conclusões:**');
        for (const takeaway of summary.takeaways) {
            lines.push(`- ${takeaway}`);
        }

        return lines.join('\n');
    }

    /**
     * Format duration between two dates
     */
    private formatDuration(start: Date, end: Date): string {
        const ms = end.getTime() - start.getTime();
        const minutes = Math.floor(ms / 60000);

        if (minutes < 1) return 'menos de 1 minuto';
        if (minutes === 1) return '1 minuto';
        if (minutes < 60) return `${minutes} minutos`;

        const hours = Math.floor(minutes / 60);
        return `${hours} hora${hours > 1 ? 's' : ''}`;
    }

    /**
     * Get conversation context for a channel
     */
    getConversationContext(channelId: string): MemoryAtom[] {
        return this.conversationCache.get(channelId) || [];
    }

    /**
     * Log message
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[BRIDGE] ${message}`);
        }
    }

    /**
     * Get stats
     */
    getStats(): {
        atomsCreated: number;
        summariesCreated: number;
        activeConversations: number;
        bufferedAtoms: number;
    } {
        return {
            atomsCreated: this.atomsCreated,
            summariesCreated: this.summariesCreated,
            activeConversations: this.conversationCache.size,
            bufferedAtoms: this.memoryBuffer.length,
        };
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create ContextBridge with default config
 */
export function createContextBridge(config?: Partial<ContextBridgeConfig>): ContextBridge {
    return new ContextBridge(config);
}

/**
 * Create production ContextBridge
 */
export function createProductionContextBridge(openAugiPath: string): ContextBridge {
    return new ContextBridge({
        openAugiPath,
        dryRun: false,
        verbose: false,
    });
}
