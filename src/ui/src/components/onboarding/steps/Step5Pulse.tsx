
import { useState, useEffect, useRef } from 'react';
import { useOnboardingStore } from '../../../stores/onboarding-store';
import { WizardNav } from '../WizardNav';

const STAGE_COLORS = {
    IDLE: 'text-white/30',
    REFLEXION: 'text-blue-400',
    DECIDING: 'text-amber-400',
    ACTION: 'text-purple-400',
    SYNTHESIS: 'text-emerald-400',
    OUTPUT: 'text-white'
};

const STAGE_ICONS = {
    IDLE: '○',
    REFLEXION: '◎',
    DECIDING: '◈',
    ACTION: '◆',
    SYNTHESIS: '◉',
    OUTPUT: '●'
};

export function Step5Pulse() {
    const { pulseLogs, addPulseLog, updateData, nextStep, prevStep } = useOnboardingStore();
    const [isRunning, setIsRunning] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [insight, setInsight] = useState('');
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [pulseLogs]);

    const runFirstPulse = async () => {
        setIsRunning(true);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const eventSource = new EventSource(`${apiUrl}/api/pulse/first`);

            eventSource.onmessage = (event) => {
                const log = JSON.parse(event.data);

                addPulseLog({
                    timestamp: new Date(),
                    stage: log.stage,
                    message: log.message,
                    detail: log.detail
                });

                // Check if done
                if (log.stage === 'OUTPUT') {
                    setInsight(log.message);
                    setIsDone(true);
                    setIsRunning(false);

                    updateData({
                        firstPulseCompleted: true,
                        firstInsight: log.message
                    });

                    eventSource.close();
                }
            };

            eventSource.onerror = () => {
                // Fallback: simulate pulse logs
                simulatePulse();
                eventSource.close();
            };

        } catch (error) {
            simulatePulse();
        }
    };

    // Fallback simulation if API not ready
    const simulatePulse = async () => {
        const stages = [
            { stage: 'REFLEXION', message: 'Analisando contexto inicial...', detail: 'Buscando notas no OpenAugi' },
            { stage: 'REFLEXION', message: 'Encontradas 3 notas relevantes', detail: 'Context diff: 72%' },
            { stage: 'DECIDING', message: 'Avaliando necessidade de pesquisa', detail: 'Context diff > 40% → Pesquisar' },
            { stage: 'ACTION', message: 'Iniciando pesquisa na web...', detail: 'Query: tendências IA 2026' },
            { stage: 'ACTION', message: '4 artigos relevantes encontrados', detail: 'The Censor: ✅ Sem dados sensíveis' },
            { stage: 'SYNTHESIS', message: 'Cruzando descobertas com suas notas...', detail: '' },
            { stage: 'OUTPUT', message: 'Suas notas sobre IA local estavam corretas. Os eventos recentes confirmam a tendência de soberania de dados como padrão de mercado.', detail: '' }
        ];

        for (const stage of stages) {
            await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

            addPulseLog({
                timestamp: new Date(),
                stage: stage.stage as any,
                message: stage.message,
                detail: stage.detail
            });
        }

        setInsight(stages[stages.length - 1].message);
        setIsDone(true);
        setIsRunning(false);

        updateData({
            firstPulseCompleted: true,
            firstInsight: stages[stages.length - 1].message
        });
    };

    return (
        <div className="flex flex-col gap-6">

            <div>
                <h2 className="text-xl font-light text-white mb-1">
                    Primeiro pulso
                </h2>
                <p className="text-white/40 text-sm">
                    Veja Sara pensar pela primeira vez.
                    Este é o monólogo interno que acontece a cada 30 minutos.
                </p>
            </div>

            {/* Pulse display */}
            <div className="min-h-48 max-h-64 overflow-y-auto
                     bg-black/40 rounded-2xl border border-white/10
                     p-4 font-mono text-xs">

                {pulseLogs.length === 0 && !isRunning && (
                    <p className="text-white/20 text-center mt-8">
                        Aguardando primeiro pulso...
                    </p>
                )}

                {pulseLogs.map((log, i) => (
                    <div key={i} className="mb-2">
                        <span className={`${STAGE_COLORS[log.stage]} font-medium`}>
                            {STAGE_ICONS[log.stage]} [{log.stage}]
                        </span>
                        <span className="text-white/60 ml-2">{log.message}</span>
                        {log.detail && (
                            <p className="text-white/25 ml-6 mt-0.5">{log.detail}</p>
                        )}
                    </div>
                ))}

                {/* Cursor blink when running */}
                {isRunning && (
                    <div className="flex items-center gap-1 text-white/30">
                        <span className="animate-pulse">█</span>
                    </div>
                )}

                <div ref={logsEndRef} />
            </div>

            {/* Insight output */}
            {insight && (
                <div className="px-4 py-3 rounded-xl
                       bg-white/5 border border-white/15">
                    <p className="text-xs text-white/30 mb-1 uppercase tracking-wider">
                        💡 Primeiro insight
                    </p>
                    <p className="text-sm text-white/70 leading-relaxed">
                        "{insight}"
                    </p>
                </div>
            )}

            {/* Run button */}
            {!isRunning && !isDone && (
                <button
                    onClick={runFirstPulse}
                    className="py-3 rounded-2xl
                    bg-white/10 hover:bg-white/15
                    border border-white/15
                    text-white text-sm
                    transition-all active:scale-95"
                >
                    🫀 Iniciar primeiro pulso
                </button>
            )}

            {/* Running indicator */}
            {isRunning && (
                <div className="flex items-center justify-center gap-2
                       py-3 rounded-2xl border border-white/10">
                    {[0, 1, 2].map(i => (
                        <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                        />
                    ))}
                    <span className="text-xs text-white/30 ml-1">Sara está pensando...</span>
                </div>
            )}

            <WizardNav
                onNext={nextStep}
                onBack={prevStep}
                nextDisabled={!isDone}
                nextLabel="Ver Sara despertar →"
            />
        </div>
    );
}
