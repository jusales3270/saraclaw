/**
 * Inner Monologue - Sara's "stream of consciousness"
 * 
 * Real-time feed of reflexion logs with Matrix-style aesthetics.
 */

import { useEffect, useRef } from 'preact/hooks';
import type { SaraLog } from '../hooks/useSaraGateway';

interface Props {
    logs: SaraLog[];
}

export function InnerMonologue({ logs }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getTypeColor = (type: SaraLog['type']) => {
        switch (type) {
            case 'thought': return 'text-zinc-300';
            case 'action': return 'text-soma-emerald';
            case 'decision': return 'text-soma-amber';
            case 'curiosity': return 'text-soma-amber/80';
            default: return 'text-zinc-400';
        }
    };

    const getTypeIcon = (type: SaraLog['type']) => {
        switch (type) {
            case 'thought': return '▸';
            case 'action': return '⚡';
            case 'decision': return '◆';
            case 'curiosity': return '?';
            default: return '▸';
        }
    };

    return (
        <div className="flex flex-col h-full bg-sara-panel border border-sara-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-sara-border bg-sara-bg/50">
                <span className="text-soma-amber font-bold uppercase tracking-widest text-xs">
                    Inner Monologue
                </span>
                <span className="text-zinc-600 text-[10px] font-mono">
                    REAL-TIME REFLEXION LOG
                </span>
            </div>

            {/* Log Feed */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar font-mono text-xs"
            >
                {logs.length === 0 ? (
                    <div className="text-zinc-700 italic animate-pulse">
                        Aguardando próximo pulso de consciência...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div
                            key={i}
                            className="animate-slide-in"
                            style={{ animationDelay: `${i * 50}ms` }}
                        >
                            <span className="text-zinc-600">
                                [{log.timestamp}]
                            </span>
                            <span className="text-soma-amber/60 mx-1">
                                {getTypeIcon(log.type)}
                            </span>
                            <span className={getTypeColor(log.type)}>
                                {log.message}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Footer - Curiosity indicator */}
            <div className="px-4 py-2 border-t border-sara-border bg-sara-bg/30">
                <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-600 uppercase">Entries</span>
                    <span className="text-zinc-500 font-mono">{logs.length}/50</span>
                </div>
            </div>
        </div>
    );
}
