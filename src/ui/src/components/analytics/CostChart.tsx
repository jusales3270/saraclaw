import { useState, useEffect } from 'react';

interface DayData {
    date: string;
    cost: number;
    requests: number;
}

interface CostChartProps {
    apiUrl: string;
}

export function CostChart({ apiUrl }: CostChartProps) {
    const [data, setData] = useState<DayData[]>([]);
    const [projection, setProjection] = useState<number | null>(null);

    useEffect(() => {
        fetch(`${apiUrl}/api/usage/monthly`)
            .then(r => r.json())
            .then(d => {
                setData(d.history || generateMockData());
                setProjection(d.projection?.estimatedMonthlyCost);
            })
            .catch(() => setData(generateMockData()));
    }, []);

    if (data.length === 0) return null;

    const maxCost = Math.max(...data.map(d => d.cost), 0.01);
    const limit = parseFloat(
        import.meta.env.VITE_DAILY_BUDGET || '2.00'
    );

    return (
        <div className="space-y-4">

            {/* Chart */}
            <div>
                <div className="flex justify-between text-xs text-white/30 mb-3">
                    <span>Últimos 7 dias</span>
                    {projection && (
                        <span className="text-white/40">
                            Projeção mensal: ${projection.toFixed(2)}
                        </span>
                    )}
                </div>

                {/* Bar chart */}
                <div className="flex items-end gap-1.5 h-28">
                    {data.slice(-7).map((day, i) => {
                        const height = Math.max((day.cost / maxCost) * 100, 2);
                        const isToday = i === data.slice(-7).length - 1;
                        const overBudget = day.cost > limit;

                        return (
                            <div key={day.date}
                                className="flex-1 flex flex-col items-center gap-1 group">
                                {/* Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100
                               absolute -translate-y-8
                               bg-black/90 text-white text-xs
                               px-2 py-1 rounded-lg
                               whitespace-nowrap pointer-events-none
                               transition-opacity z-10">
                                    ${day.cost.toFixed(3)} · {day.requests} req
                                </div>

                                {/* Bar */}
                                <div className="w-full flex flex-col justify-end"
                                    style={{ height: '100px' }}>
                                    <div
                                        className={`w-full rounded-t-sm transition-all
                               ${overBudget
                                                ? 'bg-red-400/60'
                                                : isToday
                                                    ? 'bg-white/40'
                                                    : 'bg-white/15'
                                            }`}
                                        style={{ height: `${height}%` }}
                                    />
                                </div>

                                {/* Date label */}
                                <span className={`text-xs
                                 ${isToday
                                        ? 'text-white/60'
                                        : 'text-white/20'}`}>
                                    {formatDay(day.date)}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Budget limit line indicator */}
                <div className="mt-2 flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-red-400/40" />
                    <span className="text-xs text-white/20">
                        Limite diário: ${limit.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Summary table */}
            <div className="space-y-1.5">
                <p className="text-xs text-white/30 uppercase tracking-wider">
                    Últimos 7 dias
                </p>
                {data.slice(-7).map((day) => (
                    <div key={day.date}
                        className="flex items-center justify-between
                         py-2 px-3 rounded-xl bg-white/5
                         border border-white/[0.06]">
                        <span className="text-xs text-white/40">
                            {formatFullDate(day.date)}
                        </span>
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-white/25">
                                {day.requests} req
                            </span>
                            <span className={`text-xs font-medium
                               ${day.cost > limit
                                    ? 'text-red-400'
                                    : 'text-white/60'}`}>
                                ${day.cost.toFixed(3)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function formatDay(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
}

function formatFullDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function generateMockData(): DayData[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
            date: d.toISOString().split('T')[0],
            cost: Math.random() * 1.8 + 0.2,
            requests: Math.floor(Math.random() * 80 + 20)
        };
    });
}
