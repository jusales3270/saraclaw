
import { useEffect, useRef } from 'react';
import { usePulseStore } from '../../stores/pulse-store';
import { Activity, Radio, Cpu, Database, Search, MessageSquare, Zap } from 'lucide-react';
import { ControlPanel } from './ControlPanel';

const STAGE_CONFIG = {
    IDLE: { color: 'text-white/30', icon: Radio, label: 'Aguardando' },
    REFLEXION: { color: 'text-blue-400', icon: Database, label: 'Reflexão' },
    DECIDING: { color: 'text-amber-400', icon: Activity, label: 'Decisão' },
    ACTION: { color: 'text-purple-400', icon: Search, label: 'Ação' },
    SYNTHESIS: { color: 'text-emerald-400', icon: Cpu, label: 'Síntese' },
    OUTPUT: { color: 'text-white', icon: MessageSquare, label: 'Resposta' },
    ERROR: { color: 'text-red-400', icon: Zap, label: 'Erro' }
};

export function InnerMonologue() {
    const { logs, status, connectionStatus } = usePulseStore();
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="flex flex-col h-full bg-black/40 backdrop-blur-md border md:border-l border-white/5 w-full md:w-80 lg:w-96 flex-shrink-0 transition-all font-mono text-xs overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-2">
                    <span className="text-white/50 font-medium">INNER MONOLOGUE</span>
                    {status === 'RUNNING' && (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <ControlPanel />
                    <div className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${connectionStatus === 'CONNECTED'
                        ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5'
                        : 'text-red-400 border-red-400/20 bg-red-400/5'
                        }`}>
                        {connectionStatus}
                    </div>
                </div>
            </div>


            {/* Logs Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20">
                        <Radio size={24} className="mb-2 opacity-50" />
                        <p>Aguardando atividade cerebral...</p>
                    </div>
                ) : (
                    logs.map((log) => {
                        const config = STAGE_CONFIG[log.stage] || STAGE_CONFIG.IDLE;
                        const Icon = config.icon;

                        return (
                            <div key={log.id} className="group animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-start gap-2.5">
                                    {/* Timestamp & Icon */}
                                    <div className={`mt-0.5 ${config.color}`}>
                                        <Icon size={14} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className={`font-bold ${config.color}`}>
                                                [{log.stage}]
                                            </span>
                                            <span className="text-white/20 text-[10px]">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </div>

                                        <p className="text-white/80 leading-relaxed break-words">
                                            {log.message}
                                        </p>

                                        {log.detail && (
                                            <div className="mt-1 pl-2 border-l border-white/10 text-white/40 text-[10px]">
                                                {log.detail}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Footer Info */}
            <div className="px-4 py-2 border-t border-white/5 bg-black/20 text-[10px] text-white/30 flex justify-between">
                <span>Model: Gemini 2.0 Flash</span>
                <span>${(logs.length * 0.0001).toFixed(4)} est.</span>
            </div>
        </div>
    );
}
