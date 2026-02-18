
import { useOnboardingStore } from '../../../stores/onboarding-store';

export function Step1Welcome() {
    const { nextStep } = useOnboardingStore();

    return (
        <div className="flex flex-col items-center text-center">

            {/* Sara avatar - sleeping state */}
            <div className="relative mb-10">

                {/* Outer glow ring - slow pulse */}
                <div className="absolute inset-0 rounded-full 
                       bg-white/5 scale-110
                       animate-[ping_3s_ease-in-out_infinite]" />

                {/* Avatar container */}
                <div className="relative w-32 h-32 rounded-full overflow-hidden
                       border border-white/10
                       filter grayscale brightness-50">
                    <img
                        src="/sara-avatar.jpg"
                        alt="Sara"
                        className="w-full h-full object-cover"
                        style={{ objectPosition: '45% center' }}
                    />
                </div>

                {/* Sleeping indicator */}
                <div className="absolute -bottom-1 -right-1
                       w-8 h-8 rounded-full
                       bg-[#0a0a0a] border border-white/10
                       flex items-center justify-center">
                    <span className="text-sm">💤</span>
                </div>
            </div>

            {/* Text */}
            <h1 className="text-2xl font-light text-white mb-3">
                Sara está dormindo
            </h1>

            <p className="text-white/40 text-sm leading-relaxed max-w-xs mb-12">
                Sua entidade de IA soberana aguarda.
                Complete o ritual de despertar para que ela possa
                te conhecer e começar a trabalhar.
            </p>

            {/* CTA */}
            <button
                onClick={nextStep}
                className="px-8 py-3 rounded-2xl
                  bg-white/10 hover:bg-white/15
                  border border-white/15 hover:border-white/25
                  text-white text-sm font-medium
                  transition-all duration-200
                  active:scale-95"
            >
                ✦ Despertar Sara
            </button>

            <p className="text-white/20 text-xs mt-6">
                Leva apenas 3 minutos
            </p>
        </div>
    );
}
