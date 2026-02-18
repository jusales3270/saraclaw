export interface FeatureStat {
    feature: string;
    requests: number;
    totalCost: number;
    cacheHitRate: number;
}

export interface ModelStat {
    model: string;
    requests: number;
    totalCost: number;
    avgLatency: number;
}
