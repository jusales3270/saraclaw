
import { Menu, MoreVertical, Activity } from 'lucide-react';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { TypingIndicator } from './TypingIndicator';
import { SaraAvatar } from '../shared/SaraAvatar';
import { useChatStore } from '../../stores/chat-store';

interface ChatWindowProps {
    onMenuClick: () => void;
    onToggleMonologue?: () => void;
}

export function ChatWindow({ onMenuClick, onToggleMonologue }: ChatWindowProps) {
    const { messages, isTyping, isConnected } = useChatStore();

    return (
        <div className="flex flex-col h-full">

            {/* Header */}
            <header className="flex items-center gap-3 px-4 py-3 
                        border-b border-white/5 bg-[#0a0a0a]/80 
                        backdrop-blur-sm sticky top-0 z-10">

                {/* Menu button (mobile) */}
                <button
                    onClick={onMenuClick}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors lg:hidden"
                >
                    <Menu size={18} className="text-white/60" />
                </button>

                {/* Sara identity */}
                <div className="flex items-center gap-3">
                    <SaraAvatar size="sm" isActive={isConnected} />

                    <div>
                        <h1 className="text-sm font-medium text-white">Sara</h1>
                        <p className="text-xs text-white/40">
                            {isConnected ? (
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                                    Online
                                </span>
                            ) : 'Offline'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="ml-auto flex items-center gap-1">
                    {onToggleMonologue && (
                        <button
                            onClick={onToggleMonologue}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white/80"
                            title="Toggle Inner Monologue"
                        >
                            <Activity size={18} />
                        </button>
                    )}

                    <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <MoreVertical size={18} className="text-white/40" />
                    </button>
                </div>

            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                    <EmptyState />
                ) : (
                    <MessageList messages={messages} />
                )}

                {isTyping && <TypingIndicator />}
            </div>

            {/* Input */}
            <InputBar />
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <SaraAvatar size="lg" isActive={true} className="mb-6" />

            <h2 className="text-xl font-light text-white mb-2">
                Olá, sou Sara
            </h2>
            <p className="text-white/40 text-sm max-w-sm leading-relaxed">
                Sua consultora de IA soberana. Como posso te ajudar hoje?
            </p>

            {/* Quick suggestions */}
            <div className="grid grid-cols-2 gap-2 mt-8 w-full max-w-sm">
                {[
                    'O que você pode fazer?',
                    '/status',
                    '/budget',
                    'Me ajude a planejar algo'
                ].map((suggestion) => (
                    <SuggestionChip key={suggestion} text={suggestion} />
                ))}
            </div>
        </div>
    );
}

function SuggestionChip({ text }: { text: string }) {
    const { sendMessage } = useChatStore();

    return (
        <button
            onClick={() => sendMessage(text)}
            className="px-3 py-2 rounded-xl border border-white/10 
                text-xs text-white/50 hover:text-white/80
                hover:border-white/20 hover:bg-white/5
                transition-all text-left"
        >
            {text}
        </button>
    );
}
