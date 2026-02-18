import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Info } from 'lucide-react';

interface SecurityEvent {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    blocked: boolean;
    timestamp: string;
}

export function SecurityLog({ apiUrl }: { apiUrl: string }) {
    const [logs, setLogs] = useState<SecurityEvent[]>([]);
    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            fetch(`${apiUrl}/api/security?limit=20`).then(r => r.json()),
            fetch(`${apiUrl}/api/security/summary`).then(r => r.json())
        ])
            .then(([logsData, summaryData]) => {
                setLogs(logsData.logs || []);
                setSummary(summaryData);
            })
            .catch((error) => {
                console.error('[SecurityLog] Error:', error);
                // Mock data for demo if fetch fails
                setLogs([
                    {
                        id: '1',
                        type: 'The Censor',
                        severity: 'high',
                        description: 'Tentativa de acesso a sistema de credenciais bloqueada.',
                        blocked: true,
                        timestamp: new Date().toISOString()
                    },
                    {
                        id: '2',
                        type: 'NetworkJail',
                        severity: 'low',
                        description: 'Acesso permitido a domínio whitelisted (google.com).',
                        blocked: false,
                        timestamp: new Date(Date.now() - 3600000).toISOString()
                    }
                ]);
                setSummary({ totalEvents: 12, blocked: 1, critical: 0 });
            });
    }, []);

    const SEVERITY_CONFIG = {
        low: { color: 'text-white/30', bg: 'bg-white/5', icon: Info },
        medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
        high: { color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
        critical: { color: 'text-red-500', bg: 'bg-red-500/20', icon: AlertTriangle }
    };

    return (
        <div className="space-y-4">

            {/* Summary cards */}
            {summary && (
                <div className="grid grid-cols-3 gap-2">
                    {[
                        {
                            label: 'Total',
                            value: summary.totalEvents || 0,
                            color: 'text-white/50'
                        },
                        {
                            label: 'Bloqueados',
                            value: summary.blocked || 0,
                            color: 'text-emerald-400'
                        },
                        {
                            label: 'Críticos',
                            value: summary.critical || 0,
                            color: summary.critical > 0 ? 'text-red-400' : 'text-white/30'
                        }
                    ].map(({ label, value, color }) => (
                        <div key={label}
                            className="flex flex-col items-center py-3
                           bg-white/5 rounded-xl border border-white/[0.06]">
                            <span className={`text-xl font-light ${color}`}>{value}</span>
                            <span className="text-xs text-white/25">{label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Events list */}
            <div className="space-y-1.5">
                <p className="text-xs text-white/30 uppercase tracking-wider">
                    Eventos recentes
                </p>

                {logs.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                        <Shield size={24} className="text-emerald-400/40 mb-2" />
                        <p className="text-sm text-white/30">Nenhum evento de segurança</p>
                        <p className="text-xs text-white/20 mt-1">The Censor está operando normalmente</p>
                    </div>
                ) : (
                    logs.map((event) => {
                        const config = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.low;
                        const Icon = config.icon;
                        const time = new Date(event.timestamp)
                            .toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                            });

                        return (
                            <div key={event.id}
                                className={`flex items-start gap-3 p-3 rounded-xl
                              border border-white/[0.06] ${config.bg}`}>

                                <Icon size={14} className={`${config.color} mt-0.5 flex-shrink-0`} />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <span className={`text-xs font-medium ${config.color}`}>
                                            {event.type}
                                        </span>
                                        <span className="text-xs text-white/20 flex-shrink-0">
                                            {time}
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/40 leading-relaxed">
                                        {event.description}
                                    </p>
                                    {event.blocked && (
                                        <span className="inline-block mt-1 text-xs
                                   text-emerald-400/70">
                                            ✓ Bloqueado
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
