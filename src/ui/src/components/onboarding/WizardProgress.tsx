interface WizardProgressProps {
    current: number; // 1-4
    total: number;   // 4
}

const STEP_LABELS = ['Identidade', 'Orçamento', 'Dados', 'Pulso'];

export function WizardProgress({ current, total }: WizardProgressProps) {
    return (
        <div>
            <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: total }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-0.5 flex-1 rounded-full transition-all duration-300
                       ${i < current ? 'bg-white/60' : 'bg-white/10'}`}
                    />
                ))}
            </div>

            <div className="flex justify-between">
                {STEP_LABELS.map((label, i) => (
                    <span
                        key={label}
                        className={`text-xs transition-colors
                       ${i < current ? 'text-white/50' : 'text-white/20'}`}
                    >
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}
