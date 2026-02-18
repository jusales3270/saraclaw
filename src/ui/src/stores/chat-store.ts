import { create } from 'zustand';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    attachments?: Array<{ name: string; type: string }>;
    metadata?: {
        model?: string;
        cost?: number;
        latency?: number;
    };
}

interface ChatStore {
    messages: Message[];
    isConnected: boolean;
    isTyping: boolean;
    conversationId: string | null;
    ws: WebSocket | null;

    connect: () => void;
    sendMessage: (content: string, attachments?: any[]) => Promise<void>;
    newConversation: () => void;
    addMessage: (message: Message) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
    messages: [],
    isConnected: false,
    isTyping: false,
    conversationId: null,
    ws: null,

    connect: () => {
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            set({ isConnected: true, ws });
            console.log('[Store] Connected to Sara');
        };

        ws.onclose = () => {
            set({ isConnected: false, ws: null });
            // H6 FIX: Exponential backoff
            const retryCount = (get() as any).retryCount || 0;
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30s
            console.log(`[Store] Disconnected. Reconnecting in ${delay}ms...`);

            setTimeout(() => {
                set({ retryCount: retryCount + 1 } as any);
                get().connect();
            }, delay);
        };

        ws.onmessage = (event) => {
            try {
                // H7 FIX: Safe JSON parsing
                const data = JSON.parse(event.data);

                if (data.type === 'message' || data.type === 'system' || data.type === 'whisper') {
                    set({ isTyping: false, retryCount: 0 } as any); // Reset retry on success

                    get().addMessage({
                        id: data.messageId || `msg-${Date.now()}`,
                        role: 'assistant',
                        content: data.content,
                        timestamp: new Date(),
                        metadata: data.metadata
                    });
                }

                if (data.type === 'error') {
                    set({ isTyping: false });
                    get().addMessage({
                        id: `err-${Date.now()}`,
                        role: 'assistant',
                        content: `⚠️ ${data.content}`,
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                console.error('[Store] Failed to parse WebSocket message:', error);
            }
        };
    },

    sendMessage: async (content, attachments = []) => {
        const { ws } = get();
        if (!ws) return;

        // Add user message to UI
        get().addMessage({
            id: `user-${Date.now()}`,
            role: 'user',
            content,
            timestamp: new Date(),
            attachments: attachments.map(f => ({ name: f.name, type: f.type }))
        });

        // Show typing indicator
        set({ isTyping: true });

        // Send to backend
        ws.send(JSON.stringify({
            type: content.startsWith('/') ? 'command' : 'chat',
            content,
            metadata: { conversationId: get().conversationId }
        }));
    },

    newConversation: () => {
        set({ messages: [], conversationId: null });
    },

    addMessage: (message) => {
        set(state => ({ messages: [...state.messages, message] }));
    }
}));
