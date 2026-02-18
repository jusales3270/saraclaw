import { useState } from 'react';
import { Play, Pause, AlertOctagon, Power } from 'lucide-react';
import { usePulseStore } from '../../stores/pulse-store';

export function ControlPanel() {
    const { status, setStatus } = usePulseStore();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const handleAction = async (action: 'PAUSE' | 'RESUME' | 'EMERGENCY_STOP') => {
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            await fetch(`${apiUrl}/api/pulse/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            if (action === 'PAUSE') {
                setIsPaused(true);
                setStatus('PAUSED');
            } else if (action === 'RESUME') {
                setIsPaused(false);
                setStatus('IDLE'); // Will update to RUNNING on next pulse
            } else if (action === 'EMERGENCY_STOP') {
                setStatus('ERROR');
                setIsPaused(true);
            }

        } catch (error) {
            console.error('Failed to execute action:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex items-center gap-1">
            {/* Play/Pause Button */}
            {isPaused ? (
                <button
                    onClick={() => handleAction('RESUME')}
                    disabled={isProcessing}
                    className="p-1.5 rounded-md hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                    title="Resumir atividade autônoma"
                >
                    <Play size={14} fill="currentColor" />
                </button>
            ) : (
                <button
                    onClick={() => handleAction('PAUSE')}
                    disabled={isProcessing}
                    className="p-1.5 rounded-md hover:bg-amber-500/10 text-amber-400 transition-colors"
                    title="Pausar atividade (termina ciclo atual)"
                >
                    <Pause size={14} fill="currentColor" />
                </button>
            )}

            {/* Emergency Stop - The "Red Button" */}
            <button
                onClick={() => {
                    if (confirm('ATENÇÃO: Isso desligará forçadamente o scheduler da Sara. Continuar?')) {
                        handleAction('EMERGENCY_STOP');
                    }
                }}
                disabled={isProcessing}
                className="p-1.5 rounded-md hover:bg-red-500/20 text-red-500 transition-colors ml-1"
                title="PARADA DE EMERGÊNCIA (Kill Switch)"
            >
                <AlertOctagon size={14} />
            </button>
        </div>
    );
}
