import { useState, useEffect } from 'react';
import { X, TrendingUp, Shield, Cpu, Zap } from 'lucide-react';
import { CostChart } from './CostChart';
import { ModelBreakdown } from './ModelBreakdown';
import { CacheStats } from './CacheStats';
import { SecurityLog } from './SecurityLog';
import type { FeatureStat, ModelStat } from './types';

export type { FeatureStat, ModelStat } from './types';

type Tab = 'costs' | 'models' | 'security' | 'cache';

interface AnalyticsPanelProps {
    onClose: () => void;
}

interface TodaySummary {
    budget: {
        spent: number;
        limit: number;
        remaining: number;
        percentage: number;
    };
    summary: {
        totalRequests: number;
        totalCost: number;
        avgCostPerRequest: number;
    };
    byFeature: FeatureStat[];
    byModel: ModelStat[];
}

export function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
    const [activeTab, setActiveTab] = useState<Tab>('costs');
    const [todayData, setTodayData] = useState<TodaySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        fetchTodayData();
        // Refresh every 30s
        const interval = setInterval(fetchTodayData, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchTodayData = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/usage/today`);
            if (!res.ok) throw new Error('Failed to fetch data');
            const data = await res.json();
            setTodayData(data);
        } catch (error) {
            console.error('[Analytics] Error:', error);
            // Fallback mock data if API fails (for demo purposes)
            setTodayData({
                budget: {
                    spent: 0.145,
                    limit: 2.0,
                    remaining: 1.855,
                    percentage: 7.25
                },
                summary: {
                    totalRequests: 42,
                    totalCost: 0.145,
                    avgCostPerRequest: 0.0034
                },
                byFeature: [],
                byModel: []
            });
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = [
        { id: 'costs' as Tab, label: 'Custos', icon: TrendingUp },
        { id: 'models' as Tab, label: 'Modelos', icon: Cpu },
        { id: 'security' as Tab, label: 'Segurança', icon: Shield },
        { id: 'cache' as Tab, label: 'Cache', icon: Zap }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                   bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col
                     bg-[#111111] rounded-2xl border border-white/10
                     overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between
                       px-5 py-4 border-b border-white/5">
                    <div>
                        <h2 className="text-sm font-medium text-white">Analytics</h2>
                        <p className="text-xs text-white/30 mt-0.5">
                            Transparência total de uso e custos
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/5
                      text-white/30 hover:text-white/60
                      transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Today Summary Bar */}
                {todayData && (
                    <div className="grid grid-cols-4 gap-px bg-white/5">
                        {[
                            {
                                label: 'Gasto hoje',
                                value: `$${todayData.budget.spent.toFixed(3)}`,
                                sub: `de $${todayData.budget.limit.toFixed(2)}`,
                                color: todayData.budget.percentage > 80
                                    ? 'text-red-400'
                                    : todayData.budget.percentage > 50
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                            },
                            {
                                label: 'Requests',
                                value: todayData.summary.totalRequests.toString(),
                                sub: 'hoje',
                                color: 'text-white/70'
                            },
                            {
                                label: 'Custo médio',
                                value: `$${todayData.summary.avgCostPerRequest.toFixed(4)}`,
                                sub: 'por request',
                                color: 'text-white/70'
                            },
                            {
                                label: 'Restante',
                                value: `$${todayData.budget.remaining.toFixed(3)}`,
                                sub: `${(100 - todayData.budget.percentage).toFixed(0)}% livre`,
                                color: 'text-white/70'
                            }
                        ].map(({ label, value, sub, color }) => (
                            <div key={label}
                                className="flex flex-col items-center py-3
                             bg-[#111111]">
                                <span className={`text-lg font-light ${color}`}>{value}</span>
                                <span className="text-xs text-white/25 mt-0.5">{label}</span>
                                <span className="text-xs text-white/15">{sub}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Budget progress bar */}
                {todayData && (
                    <div className="px-5 py-3 border-b border-white/5">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700
                           ${todayData.budget.percentage > 80 ? 'bg-red-400' :
                                        todayData.budget.percentage > 50 ? 'bg-amber-400' :
                                            'bg-emerald-400'}`}
                                style={{ width: `${Math.min(todayData.budget.percentage, 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 px-5 py-2 border-b border-white/5">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         text-xs transition-all
                         ${activeTab === id
                                    ? 'bg-white/10 text-white/80'
                                    : 'text-white/30 hover:text-white/50 hover:bg-white/5'
                                }`}
                        >
                            <Icon size={12} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-white/20 text-sm">Carregando...</div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'costs' && <CostChart apiUrl={apiUrl} />}
                            {activeTab === 'models' && (
                                <ModelBreakdown data={todayData?.byModel || []} />
                            )}
                            {activeTab === 'security' && <SecurityLog apiUrl={apiUrl} />}
                            {activeTab === 'cache' && (
                                <CacheStats data={todayData?.byFeature || []} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
