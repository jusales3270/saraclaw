
import { useState } from 'react';
import { X, Plus, Settings, BarChart2, Shield } from 'lucide-react';
import { ConversationList } from './ConversationList';
import { StatusPanel } from './StatusPanel';
import { SaraAvatar } from '../shared/SaraAvatar';
import { useChatStore } from '../../stores/chat-store';
import { AnalyticsPanel } from '../analytics/AnalyticsPanel';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { newConversation } = useChatStore();
    const [showAnalytics, setShowAnalytics] = useState(false);

    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-20 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar panel */}
            <aside className={`
        fixed lg:relative inset-y-0 left-0 z-30 lg:z-auto
        w-64 flex flex-col
        bg-[#111111] border-r border-white/5
        transform transition-transform duration-200
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

                {/* Header */}
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                        <SaraAvatar size="sm" isActive={true} />
                        <span className="text-sm font-medium text-white/80">Sara</span>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/5 
                      text-white/40 lg:hidden"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* New conversation */}
                <div className="px-3 mb-2">
                    <button
                        onClick={newConversation}
                        className="w-full flex items-center gap-2 px-3 py-2
                      rounded-xl border border-white/10
                      hover:border-white/20 hover:bg-white/5
                      text-sm text-white/60 hover:text-white/80
                      transition-all"
                    >
                        <Plus size={16} />
                        Nova conversa
                    </button>
                </div>

                {/* Conversations */}
                <div className="flex-1 overflow-y-auto px-3">
                    <p className="text-xs text-white/25 px-2 mb-2 mt-2 uppercase tracking-wider">
                        Histórico
                    </p>
                    <ConversationList />
                </div>

                {/* Status Panel */}
                <div className="p-3 border-t border-white/5">
                    <StatusPanel />
                </div>

                {/* Bottom nav */}
                <nav className="px-3 pb-4 space-y-1">
                    <button
                        onClick={() => setShowAnalytics(true)}
                        className="w-full flex items-center gap-2.5 px-3 py-2
                        rounded-xl text-sm text-white/40
                        hover:text-white/70 hover:bg-white/5
                        transition-all"
                    >
                        <BarChart2 size={16} />
                        Analytics
                    </button>

                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-2
                        rounded-xl text-sm text-white/40
                        hover:text-white/70 hover:bg-white/5
                        transition-all"
                    >
                        <Settings size={16} />
                        Configurações
                    </button>
                </nav>
            </aside>

            {/* Analytics Modal */}
            {showAnalytics && (
                <AnalyticsPanel onClose={() => setShowAnalytics(false)} />
            )}
        </>
    );
}
