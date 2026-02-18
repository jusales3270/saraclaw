import { useEffect, useState } from 'react';

interface SaraStatus {
    budget: { spent: number; limit: number };
    heartbeat: { isRunning: boolean; totalPulses: number };
}

export function StatusPanel() {
    const [status, setStatus] = useState<SaraStatus | null>(null);

    useEffect(() => {
        // Fetch from REST API
        fetch('http://localhost:3001/api/usage/today')
            .then(r => r.json())
            .then(data => setStatus({
                budget: {
                    spent: data.budget.spent,
                    limit: data.budget.limit
                },
                heartbeat: {
                    isRunning: true,
                    totalPulses: 0
                }
            }))
            .catch(console.error);
    }, []);

    if (!status) return null;

    const budgetPercent = (status.budget.spent / status.budget.limit) * 100;

    return (
        <div className="space-y-3">

            {/* Budget */}
            <div>
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/30">Budget hoje</span>
                    <span className="text-white/50">
                        ${status.budget.spent.toFixed(2)} / ${status.budget.limit.toFixed(2)}
                    </span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all
                       ${budgetPercent > 80 ? 'bg-red-400' :
                                budgetPercent > 50 ? 'bg-amber-400' :
                                    'bg-emerald-400'}`}
                        style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                    />
                </div>
            </div>

            {/* Heartbeat */}
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full
                        ${status.heartbeat.isRunning
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-white/20'}`}
                />
                <span className="text-xs text-white/30">
                    {status.heartbeat.isRunning ? 'Autônoma ativa' : 'Em pausa'}
                </span>
            </div>
        </div>
    );
}
