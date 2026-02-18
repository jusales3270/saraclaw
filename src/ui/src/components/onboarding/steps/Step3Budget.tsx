
import { useState } from 'react';
import { useOnboardingStore } from '../../../stores/onboarding-store';
import { WizardNav } from '../WizardNav';

function estimateUsage(budget: number) {
    const chats = Math.floor((budget * 0.4) / 0.003);
    const searches = Math.floor((budget * 0.3) / 0.08);
    const tasks = Math.floor((budget * 0.3) / 0.15);

    return { chats, searches, tasks };
}

export function Step3Budget() {
    const { data, updateData, nextStep, prevStep } = useOnboardingStore();
    const [budget, setBudget] = useState(data.dailyBudget || 2);
    const [allowEmergency, setAllowEmergency] = useState(
        data.allowEmergency || false
    );

    const estimate = estimateUsage(budget);

    const budgetColor = budget <= 1 ? 'text-amber-400' :
        budget <= 5 ? 'text-emerald-400' :
            'text-blue-400';

    const handleNext = () => {
        updateData({ dailyBudget: budget, allowEmergency });
        nextStep();
    };

    return (
        <div className="flex flex-col gap-6">

            <div>
                <h2 className="text-xl font-light text-white mb-1">
                    Seu orçamento diário
                </h2>
                <p className="text-white/40 text-sm">
                    Sara vai gerenciar os custos automaticamente.
                    Quando atingir o limite, ela pausa até meia-noite.
                </p>
            </div>

            {/* Budget display */}
            <div className="text-center py-4">
                <span className={`text-5xl font-light ${budgetColor}`}>
                    ${budget.toFixed(2)}
                </span>
                <span className="text-white/30 text-sm ml-2">/ dia</span>
            </div>

            {/* Slider */}
            <div>
                <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={budget}
                    onChange={(e) => setBudget(parseFloat(e.target.value))}
                    className="w-full accent-white/80"
                />
                <div className="flex justify-between text-xs text-white/25 mt-1">
                    <span>$0.50</span>
                    <span>$5.00</span>
                    <span>$10.00</span>
                </div>
            </div>

            {/* Estimate */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Chats', value: estimate.chats, icon: '💬' },
                    { label: 'Pesquisas', value: estimate.searches, icon: '🔍' },
                    { label: 'Tarefas CUA', value: estimate.tasks, icon: '🤖' }
                ].map(({ label, value, icon }) => (
                    <div key={label}
                        className="flex flex-col items-center py-3 px-2
                         bg-white/5 rounded-xl border border-white/10">
                        <span className="text-lg mb-1">{icon}</span>
                        <span className="text-white text-sm font-medium">{value}</span>
                        <span className="text-white/30 text-xs">{label}</span>
                    </div>
                ))}
            </div>

            {/* Emergency override */}
            <label className="flex items-center gap-3 cursor-pointer
                       px-4 py-3 rounded-xl border border-white/10
                       hover:border-white/15 transition-colors">
                <div className={`w-10 h-6 rounded-full transition-colors relative
                        ${allowEmergency ? 'bg-white/30' : 'bg-white/10'}`}
                    onClick={() => setAllowEmergency(!allowEmergency)}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white
                          transition-transform
                          ${allowEmergency ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <div>
                    <p className="text-sm text-white/70">Gastos de emergência</p>
                    <p className="text-xs text-white/30">Permite até 2x o limite em situações críticas</p>
                </div>
            </label>

            <WizardNav onNext={handleNext} onBack={prevStep} />
        </div>
    );
}
