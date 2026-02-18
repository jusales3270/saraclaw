import type { ModelStat } from './types';

interface ModelBreakdownProps {
    data: ModelStat[];
}

const MODEL_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
    'claude-opus': {
        label: 'Claude Opus',
        color: 'bg-purple-400/60',
        emoji: '🧠'
    },
    'kimi-k2': {
        label: 'Kimi K2.5',
        color: 'bg-blue-400/60',
        emoji: '⚡'
    },
    'gemini-flash': {
        label: 'Gemini Flash',
        color: 'bg-emerald-400/60',
        emoji: '🚀'
    }
};

export function ModelBreakdown({ data }: ModelBreakdownProps) {
    const totalCost = data.reduce((sum, m) => sum + m.totalCost, 0);
    const totalRequests = data.reduce((sum, m) => sum + m.requests, 0);

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center py-12 text-center">
                <span className="text-3xl mb-3">🤖</span>
                <p className="text-sm text-white/30">Nenhum uso registrado hoje</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* Model cards */}
            <div className="space-y-2">
                {data.map((model) => {
                    const config = MODEL_CONFIG[model.model] || {
                        label: model.model,
                        color: 'bg-white/20',
                        emoji: '🤖'
                    };
                    const pct = totalCost > 0
                        ? (model.totalCost / totalCost) * 100
                        : 0;

                    return (
                        <div key={model.model}
                            className="p-3 rounded-xl bg-white/5 border border-white/[0.06]">

                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span>{config.emoji}</span>
                                    <span className="text-sm text-white/70">{config.label}</span>
                                </div>
                                <span className="text-sm text-white/50 font-medium">
                                    ${model.totalCost.toFixed(4)}
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-2">
                                <div
                                    className={`h-full rounded-full ${config.color}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>

                            {/* Stats row */}
                            <div className="flex justify-between text-xs text-white/25">
                                <span>{model.requests} requests</span>
                                <span>{pct.toFixed(1)}% do total</span>
                                <span>~{model.avgLatency}ms avg</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center
                     pt-3 border-t border-white/5">
                <span className="text-xs text-white/30">Total hoje</span>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-white/30">
                        {totalRequests} requests
                    </span>
                    <span className="text-sm text-white/60 font-medium">
                        ${totalCost.toFixed(4)}
                    </span>
                </div>
            </div>
        </div>
    );
}
