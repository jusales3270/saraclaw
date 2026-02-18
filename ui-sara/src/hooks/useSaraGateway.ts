/**
 * Sara Gateway WebSocket Hook
 * 
 * Connects to the Sara gateway for real-time status updates.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';

// ============================================
// TYPES
// ============================================

export interface SaraLog {
    timestamp: string;
    type: 'thought' | 'action' | 'decision' | 'curiosity';
    message: string;
}

export interface SaraMetrics {
    budget: {
        dailyCost: number;
        dailyLimit: number;
        usagePercent: number;
    };
    pulses: {
        total: number;
        successful: number;
        failed: number;
    };
    security: {
        censorEvents: number;
        jailEvents: number;
    };
    uptime: number;
    nextPulseAt: string | null;
}

export interface SaraState {
    status: 'OFFLINE' | 'CONNECTING' | 'ONLINE' | 'ERROR';
    schedulerState: 'STOPPED' | 'IDLE' | 'PULSING' | 'BUDGET_EXHAUSTED' | 'SHUTDOWN' | 'ERROR';
    logs: SaraLog[];
    metrics: SaraMetrics;
}

// ============================================
// DEFAULT STATE
// ============================================

const DEFAULT_METRICS: SaraMetrics = {
    budget: { dailyCost: 0, dailyLimit: 2.00, usagePercent: 0 },
    pulses: { total: 0, successful: 0, failed: 0 },
    security: { censorEvents: 0, jailEvents: 0 },
    uptime: 0,
    nextPulseAt: null,
};

// ============================================
// HOOK
// ============================================

export function useSaraGateway(url: string) {
    const [status, setStatus] = useState<SaraState['status']>('OFFLINE');
    const [schedulerState, setSchedulerState] = useState<SaraState['schedulerState']>('STOPPED');
    const [logs, setLogs] = useState<SaraLog[]>([]);
    const [metrics, setMetrics] = useState<SaraMetrics>(DEFAULT_METRICS);

    // Send message to gateway
    const sendMessage = useCallback((type: string, payload?: unknown) => {
        // Will be implemented with actual WebSocket
        console.log('[Sara Gateway] Send:', type, payload);
    }, []);

    // Emergency stop
    const emergencyStop = useCallback(() => {
        sendMessage('EMERGENCY_STOP', { source: 'ui' });
        setSchedulerState('SHUTDOWN');
    }, [sendMessage]);

    useEffect(() => {
        setStatus('CONNECTING');

        let ws: WebSocket | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout>;

        const connect = () => {
            try {
                ws = new WebSocket(url);

                ws.onopen = () => {
                    setStatus('ONLINE');
                    console.log('[Sara Gateway] Connected');
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        // Handle different message types
                        switch (data.type) {
                            case 'REFLECTION_LOG':
                            case 'sara.monologue':
                                setLogs(prev => {
                                    const newLogs = [...prev, {
                                        timestamp: data.payload.timestamp || new Date().toISOString(),
                                        type: data.payload.type || 'thought',
                                        message: data.payload.message,
                                    }];
                                    return newLogs.slice(-50); // Keep last 50
                                });
                                break;

                            case 'METRICS_UPDATE':
                            case 'sara.status':
                                if (data.payload.scheduler) {
                                    setSchedulerState(data.payload.scheduler.state);
                                    setMetrics(prev => ({
                                        ...prev,
                                        uptime: data.payload.scheduler.uptime,
                                        nextPulseAt: data.payload.scheduler.nextPulseAt,
                                        pulses: data.payload.scheduler.metrics || prev.pulses,
                                    }));
                                }
                                if (data.payload.budget) {
                                    setMetrics(prev => ({
                                        ...prev,
                                        budget: data.payload.budget,
                                    }));
                                }
                                if (data.payload.security) {
                                    setMetrics(prev => ({
                                        ...prev,
                                        security: data.payload.security,
                                    }));
                                }
                                break;

                            case 'sara.state':
                                setSchedulerState(data.payload.state);
                                break;
                        }
                    } catch (err) {
                        console.error('[Sara Gateway] Parse error:', err);
                    }
                };

                ws.onclose = () => {
                    setStatus('OFFLINE');
                    console.log('[Sara Gateway] Disconnected, reconnecting...');
                    reconnectTimer = setTimeout(connect, 3000);
                };

                ws.onerror = () => {
                    setStatus('ERROR');
                };
            } catch (err) {
                setStatus('ERROR');
                reconnectTimer = setTimeout(connect, 5000);
            }
        };

        connect();

        return () => {
            if (ws) ws.close();
            clearTimeout(reconnectTimer);
        };
    }, [url]);

    return {
        status,
        schedulerState,
        logs,
        metrics,
        sendMessage,
        emergencyStop,
    };
}

// ============================================
// MOCK HOOK (for demo)
// ============================================

export function useMockSaraGateway() {
    const [logs, setLogs] = useState<SaraLog[]>([
        { timestamp: '09:14:22', type: 'thought', message: 'Iniciando ciclo de reflexão...' },
        { timestamp: '09:14:23', type: 'curiosity', message: 'Curiosity differential: 0.72 - Pesquisa recomendada' },
        { timestamp: '09:14:25', type: 'action', message: 'Consultando ChromaDB para contexto relevante' },
    ]);
    const [metrics, setMetrics] = useState<SaraMetrics>({
        budget: { dailyCost: 0.42, dailyLimit: 2.00, usagePercent: 21 },
        pulses: { total: 14, successful: 13, failed: 1 },
        security: { censorEvents: 2, jailEvents: 0 },
        uptime: 7200000,
        nextPulseAt: new Date(Date.now() + 1800000).toISOString(),
    });

    useEffect(() => {
        const interval = setInterval(() => {
            const thoughts = [
                { type: 'thought' as const, message: 'Analisando padrões de conhecimento...' },
                { type: 'curiosity' as const, message: 'Contexto expandido com nova informação' },
                { type: 'action' as const, message: 'Salvando insight no journaling' },
                { type: 'decision' as const, message: 'Diferencial baixo - mantendo estado IDLE' },
            ];
            const random = thoughts[Math.floor(Math.random() * thoughts.length)];

            setLogs(prev => [...prev, {
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }).slice(0, 8),
                ...random,
            }].slice(-50));

            setMetrics(prev => ({
                ...prev,
                uptime: prev.uptime + 5000,
                budget: {
                    ...prev.budget,
                    dailyCost: Math.min(prev.budget.dailyCost + 0.001, prev.budget.dailyLimit),
                },
            }));
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return {
        status: 'ONLINE' as const,
        schedulerState: 'IDLE' as const,
        logs,
        metrics,
        sendMessage: () => { },
        emergencyStop: () => alert('Emergency stop triggered!'),
    };
}
