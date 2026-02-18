import type { FeatureStat } from './types';

const FEATURE_CONFIG: Record<string, { label: string; emoji: string }> = {
    echo: { label: 'Chat (Echo)', emoji: '💬' },
    whisper: { label: 'Insights (Whisper)', emoji: '💡' },
    cua: { label: 'Automação (CUA)', emoji: '🤖' },
    heartbeat: { label: 'Batimento', emoji: '🫀' },
    'monthly-review': { label: 'Review Mensal', emoji: '📊' }
};

export function CacheStats({ data }: { data: FeatureStat[] }) {
    const totalRequests = data.reduce((sum, f) => sum + f.requests, 0);
    const totalCost = data.reduce((sum, f) => sum + f.totalCost, 0);
    const avgCacheRate = data.length > 0
        ? data.reduce((sum, f) => sum + f.cacheHitRate, 0) / data.length
        : 0;
    const estimatedSavings = totalCost * (avgCacheRate / 100) * 0.75;

    return (
        <div className="space-y-4">

            {/* Cache summary */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    {
                        label: 'Cache hit rate',
                        value: `${avgCacheRate.toFixed(1)}%`,
                        sub: 'média global',
                        color: avgCacheRate > 40
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                    },
                    {
                        label: 'Economizado',
                        value: `$${estimatedSavings.toFixed(4)}`,
                        sub: 'hoje com cache',
                        color: 'text-white/70'
                    }
                ].map(({ label, value, sub, color }) => (
                    <div key={label}
                        className="flex flex-col items-center py-4
                         bg-white/5 rounded-xl border border-white/[0.06]">
                        <span className={`text-xl font-light ${color}`}>{value}</span>
                        <span className="text-xs text-white/30 mt-1">{label}</span>
                        <span className="text-xs text-white/15">{sub}</span>
                    </div>
                ))}
            </div>

            {/* Per feature */}
            <div className="space-y-2">
                <p className="text-xs text-white/30 uppercase tracking-wider">
                    Por feature
                </p>

                {data.map((feat) => {
                    const config = FEATURE_CONFIG[feat.feature] || {
                        label: feat.feature,
                        emoji: '⚙️'
                    };

                    return (
                        <div key={feat.feature}
                            className="flex items-center gap-3
                           py-2.5 px-3 rounded-xl
                           bg-white/5 border border-white/[0.06]">

                            <span>{config.emoji}</span>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between mb-1">
                                    <span className="text-xs text-white/60">
                                        {config.label}
                                    </span>
                                    <span className="text-xs text-white/40">
                                        ${feat.totalCost.toFixed(4)}
                                    </span>
                                </div>

                                {/* Cache rate bar */}
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full
                               ${feat.cacheHitRate > 40
                                                ? 'bg-emerald-400/50'
                                                : 'bg-amber-400/50'}`}
                                        style={{ width: `${feat.cacheHitRate}%` }}
                                    />
                                </div>
                            </div>

                            <span className="text-xs text-white/30 flex-shrink-0">
                                {feat.cacheHitRate.toFixed(0)}% cache
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
