import { create } from 'zustand';

export interface PulseLog {
    id: string; // unique ID for key
    timestamp: Date;
    stage: 'IDLE' | 'REFLEXION' | 'DECIDING' | 'ACTION' | 'SYNTHESIS' | 'OUTPUT' | 'ERROR';
    message: string;
    detail?: string;
    duration?: number;
}

interface PulseState {
    status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR';
    logs: PulseLog[];
    currentStage: PulseLog['stage'];
    connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

    // Actions
    addLog: (log: Omit<PulseLog, 'id' | 'timestamp'>) => void;
    setStatus: (status: PulseState['status']) => void;
    setConnectionStatus: (status: PulseState['connectionStatus']) => void;
    clearLogs: () => void;
}

export const usePulseStore = create<PulseState>((set) => ({
    status: 'IDLE',
    logs: [],
    currentStage: 'IDLE',
    connectionStatus: 'DISCONNECTED',

    addLog: (log) => set((state) => {
        const newLog = {
            ...log,
            id: Math.random().toString(36).substring(7),
            timestamp: new Date()
        };

        // Keep max 50 logs to avoid memory issues
        const updatedLogs = [...state.logs, newLog].slice(-50);

        return {
            logs: updatedLogs,
            currentStage: log.stage,
            status: log.stage === 'IDLE' ? 'IDLE' : 'RUNNING'
        };
    }),

    setStatus: (status) => set({ status }),

    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

    clearLogs: () => set({ logs: [], currentStage: 'IDLE' })
}));
