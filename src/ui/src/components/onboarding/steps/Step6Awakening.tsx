
import { useEffect, useState } from 'react';
import { useOnboardingStore } from '../../../stores/onboarding-store';

export function Step6Awakening() {
    const { data, completeOnboarding } = useOnboardingStore();
    const [phase, setPhase] = useState<'awakening' | 'ready'>('awakening');

    // Save config to API
    useEffect(() => {
        const saveConfig = async () => {
            try {
                await fetch(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/config`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            budget: {
                                dailyLimit: data.dailyBudget,
                                allowEmergency: data.allowEmergency
                            },
                            preferences: {
                                userName: data.name,
                                profession: data.profession,
                                responseStyle: data.responseStyle
                            }
                        })
                    }
                );
            } catch (error) {
                console.error('Failed to save config:', error);
            }
        };

        saveConfig();

        // Phase transition
        const timer = setTimeout(() => setPhase('ready'), 2000);
        return () => clearTimeout(timer);
    }, []);

    const handleEnter = () => {
        completeOnboarding();
    };

    return (
        <div className="flex flex-col items-center text-center">

            {/* Avatar - awakening animation */}
            <div className="relative mb-8">

                {/* Glow rings */}
                <div className={`absolute inset-0 rounded-full
                        transition-all duration-1000
                        ${phase === 'ready'
                        ? 'bg-white/10 scale-150 opacity-100'
                        : 'bg-white/5 scale-110 opacity-50'
                    }
                        animate-ping`}
                    style={{ animationDuration: '2s' }} />

                {/* Avatar */}
                <div className={`relative w-32 h-32 rounded-full overflow-hidden
                        border transition-all duration-1000
                        ${phase === 'ready'
                        ? 'border-white/30 filter-none'
                        : 'border-white/10 filter grayscale brightness-75'
                    }`}>
                    <img
                        src="/sara-avatar.jpg"
                        alt="Sara"
                        className="w-full h-full object-cover"
                        style={{ objectPosition: '45% center' }}
                    />
                </div>

                {/* Active indicator */}
                {phase === 'ready' && (
                    <span className="absolute bottom-1 right-1
                          w-5 h-5 rounded-full
                          bg-emerald-400
                          border-2 border-[#0a0a0a]
                          animate-pulse" />
                )}
            </div>

            {/* Message */}
            {phase === 'awakening' ? (
                <div>
                    <h2 className="text-2xl font-light text-white mb-3">
                        Sara está acordando...
                    </h2>
                    <div className="flex justify-center gap-1">
                        {[0, 1, 2].map(i => (
                            <span
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div>
                    <h2 className="text-2xl font-light text-white mb-3">
                        Olá, {data.name}! 👋
                    </h2>
                    <p className="text-white/40 text-sm max-w-xs leading-relaxed mb-8">
                        Estou pronta. Já processei seus dados e tenho
                        contexto suficiente para começar a te ajudar.
                    </p>

                    {/* First insight preview */}
                    {data.firstInsight && (
                        <div className="mb-8 px-4 py-3 rounded-xl
                           bg-white/5 border border-white/15
                           text-left">
                            <p className="text-xs text-white/30 mb-1">💡 Meu primeiro insight</p>
                            <p className="text-xs text-white/60 leading-relaxed">
                                "{data.firstInsight}"
                            </p>
                        </div>
                    )}

                    {/* CTA */}
                    <button
                        onClick={handleEnter}
                        className="px-8 py-3 rounded-2xl
                      bg-white/15 hover:bg-white/20
                      border border-white/20 hover:border-white/30
                      text-white text-sm font-medium
                      transition-all active:scale-95"
                    >
                        Começar a conversar →
                    </button>
                </div>
            )}
        </div>
    );
}
