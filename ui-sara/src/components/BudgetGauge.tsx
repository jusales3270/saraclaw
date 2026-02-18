/**
 * Budget Gauge - Financial Monitor
 * 
 * Displays daily budget consumption with progress bar and security incidents.
 */

import type { SaraMetrics } from '../hooks/useSaraGateway';

interface Props {
    budget: SaraMetrics['budget'];
    security: SaraMetrics['security'];
    onEmergencyStop: () => void;
}

export function BudgetGauge({ budget, security, onEmergencyStop }: Props) {
    const usagePercent = budget.dailyLimit > 0
        ? (budget.dailyCost / budget.dailyLimit) * 100
        : 0;

    const getBarColor = () => {
        if (usagePercent >= 90) return 'bg-soma-rose';
        if (usagePercent >= 70) return 'bg-soma-amber';
        return 'bg-soma-emerald';
    };

    const getGlowClass = () => {
        if (usagePercent >= 90) return 'glow-rose';
        if (usagePercent >= 70) return 'glow-amber';
        return '';
    };

    return (
        <div className="bg-sara-panel border border-sara-border rounded-lg p-4 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-sara-border">
                <span className="text-soma-amber font-bold uppercase tracking-widest text-xs">
                    Recursos
                </span>
                <span className="text-zinc-600 text-[10px] font-mono">
                    BUDGET & SECURITY
                </span>
            </div>

            {/* Budget Bar */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-500 text-xs">Orçamento Diário</span>
                    <span className="text-zinc-300 font-mono text-xs">
                        ${budget.dailyCost.toFixed(2)} / ${budget.dailyLimit.toFixed(2)}
                    </span>
                </div>
                <div className="h-2 bg-sara-bg rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${getBarColor()} ${getGlowClass()}`}
                        style={{ width: `${Math.min(100, usagePercent)}%` }}
                    />
                </div>
                <div className="mt-1 text-right">
                    <span className={`text-[10px] font-mono ${usagePercent >= 90 ? 'text-soma-rose' :
                            usagePercent >= 70 ? 'text-soma-amber' : 'text-zinc-600'
                        }`}>
                        {usagePercent.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Security Incidents */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-sara-bg rounded-lg p-3 text-center">
                    <span className="block text-2xl font-bold font-mono text-zinc-200">
                        {security.censorEvents}
                    </span>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
                        Censor
                    </span>
                </div>
                <div className="bg-sara-bg rounded-lg p-3 text-center">
                    <span className="block text-2xl font-bold font-mono text-zinc-200">
                        {security.jailEvents}
                    </span>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
                        Jail
                    </span>
                </div>
            </div>

            {/* Emergency Stop */}
            <div className="mt-auto pt-4 border-t border-sara-border">
                <button
                    onClick={onEmergencyStop}
                    className="w-full py-2.5 px-4 bg-transparent border-2 border-soma-rose text-soma-rose 
                     rounded-lg font-bold uppercase text-xs tracking-wider
                     hover:bg-soma-rose hover:text-sara-bg transition-all duration-200
                     active:scale-[0.98]"
                >
                    🚨 Emergency Stop
                </button>
            </div>
        </div>
    );
}
