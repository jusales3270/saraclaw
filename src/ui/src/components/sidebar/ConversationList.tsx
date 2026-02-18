import { MessageSquare } from 'lucide-react';

export function ConversationList() {
    // Mock data for now, as the store doesn't support conversation history listing yet
    const conversations = [
        { id: '1', title: 'Planejamento Q1', date: 'Hoje' },
        { id: '2', title: 'Review de Código', date: 'Ontem' },
    ];

    return (
        <div className="space-y-1">
            {conversations.map((conv) => (
                <button
                    key={conv.id}
                    className="w-full flex items-center gap-3 px-3 py-2
                    rounded-xl text-left transition-colors
                    hover:bg-white/5 group"
                >
                    <MessageSquare size={16} className="text-white/30 group-hover:text-white/60" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm text-white/70 truncate group-hover:text-white">
                            {conv.title}
                        </h3>
                    </div>
                    <span className="text-[10px] text-white/20">
                        {conv.date}
                    </span>
                </button>
            ))}
            {conversations.length === 0 && (
                <div className="px-4 py-8 text-center">
                    <p className="text-xs text-white/20">Nenhuma conversa recente</p>
                </div>
            )}
        </div>
    );
}
