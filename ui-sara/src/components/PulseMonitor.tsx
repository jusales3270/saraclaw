/**
 * Pulse Monitor - Sara's Heartbeat
 * 
 * Visual representation of the scheduler state and pulse cycle.
 */

import type { SaraState, SaraMetrics } from '../hooks/useSaraGateway';

interface Props {
    state: SaraState['schedulerState'];
    metrics: SaraMetrics;
}

export function PulseMonitor({ state, metrics }: Props) {
    const formatUptime = (ms: number) => {
        const hours = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        return `${hours}h ${mins}m`;
    };

    const formatCountdown = (isoString: string | null) => {
        if (!isoString) return '--:--';
        const diff = new Date(isoString).getTime() - Date.now();
        if (diff < 0) return '00:00';
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getStateColor = () => {
        switch (state) {
            case 'PULSING': return 'text-soma-emerald glow-emerald';
            case 'IDLE': return 'text-soma-emerald/60';
            case 'BUDGET_EXHAUSTED': return 'text-soma-amber glow-amber';
            case 'SHUTDOWN': return 'text-soma-rose glow-rose';
            case 'ERROR': return 'text-soma-rose';
            default: return 'text-zinc-500';
        }
    };

    const getPulseClass = () => {
        if (state === 'PULSING') return 'animate-heartbeat';
        if (state === 'IDLE') return 'animate-pulse-slow';
        return '';
    };

    return (
        <div className="bg-sara-panel border border-sara-border rounded-lg p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-sara-border">
                <span className="text-soma-emerald font-bold uppercase tracking-widest text-xs">
                    Pulse Monitor
                </span>
                <span className="text-zinc-600 text-[10px] font-mono">
                    HEARTBEAT
                </span>
            </div>

            {/* Pulse Indicator */}
            <div className="flex flex-col items-center py-4">
                <div
                    className={`w-20 h-20 rounded-full bg-gradient-to-br from-soma-emerald/30 to-transparent ${getPulseClass()}`}
                    style={{
                        boxShadow: state === 'PULSING'
                            ? '0 0 40px rgba(16, 185, 129, 0.4), inset 0 0 20px rgba(16, 185, 129, 0.2)'
                            : state === 'BUDGET_EXHAUSTED'
                                ? '0 0 40px rgba(251, 191, 36, 0.4)'
                                : 'none',
                    }}
                />
                <span className={`mt-4 text-lg font-bold font-mono ${getStateColor()}`}>
                    {state}
                </span>
            </div>

            {/* Metrics */}
            <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-600">Uptime</span>
                    <span className="text-zinc-300 font-mono">{formatUptime(metrics.uptime)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-600">Próximo Pulso</span>
                    <span className="text-soma-emerald font-mono">{formatCountdown(metrics.nextPulseAt)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-600">Total Pulsos</span>
                    <span className="text-zinc-300 font-mono">{metrics.pulses.total}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-600">Sucesso/Falha</span>
                    <span className="font-mono">
                        <span className="text-soma-emerald">{metrics.pulses.successful}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-soma-rose">{metrics.pulses.failed}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
