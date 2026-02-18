import { ChevronLeft } from 'lucide-react';

interface WizardNavProps {
    onNext: () => void;
    onBack?: () => void;
    nextDisabled?: boolean;
    nextLabel?: string;
    showBack?: boolean;
}

export function WizardNav({
    onNext,
    onBack,
    nextDisabled = false,
    nextLabel = 'Próximo →',
    showBack = true
}: WizardNavProps) {
    return (
        <div className="flex items-center gap-3 pt-2">
            {showBack && onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                    border border-white/10 text-white/40
                    hover:border-white/20 hover:text-white/60
                    text-sm transition-all"
                >
                    <ChevronLeft size={14} />
                    Voltar
                </button>
            )}

            <button
                onClick={onNext}
                disabled={nextDisabled}
                className="flex-1 py-3 rounded-2xl
                  bg-white/10 hover:bg-white/15
                  border border-white/15 hover:border-white/25
                  text-white text-sm font-medium
                  disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all active:scale-[0.98]"
            >
                {nextLabel}
            </button>
        </div>
    );
}
