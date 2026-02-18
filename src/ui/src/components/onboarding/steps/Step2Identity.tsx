
import { useState } from 'react';
import { useOnboardingStore } from '../../../stores/onboarding-store';
import { WizardNav } from '../WizardNav';

const PROFESSIONS = [
    'Desenvolvedor(a)',
    'Executivo(a) / Gestor(a)',
    'Consultor(a) / Freelancer',
    'Empreendedor(a)',
    'Pesquisador(a)',
    'Outro'
];

const STYLE_EXAMPLES = {
    direct: {
        label: 'Direto',
        description: 'Respostas curtas e objetivas',
        example: '"Sim. Anthropic. Foco em segurança alinha com seus valores."'
    },
    analytic: {
        label: 'Analítico',
        description: 'Dados, prós e contras, referências',
        example: '"Baseado em 3 critérios:\n• Segurança: Anthropic +\n• Market: OpenAI +\nRecomendo: 60/40"'
    },
    socratic: {
        label: 'Socrático',
        description: 'Perguntas para guiar reflexão',
        example: '"O que você valorizaria mais: crescimento rápido ou sustentabilidade?"'
    }
};

export function Step2Identity() {
    const { data, updateData, nextStep, prevStep } = useOnboardingStore();
    const [name, setName] = useState(data.name || '');
    const [profession, setProfession] = useState(data.profession || '');
    const [style, setStyle] = useState<'direct' | 'analytic' | 'socratic'>(
        data.responseStyle || 'analytic'
    );

    const isValid = name.trim().length > 0 && profession.length > 0;

    const handleNext = () => {
        if (!isValid) return;
        updateData({ name, profession, responseStyle: style });
        nextStep();
    };

    return (
        <div className="flex flex-col gap-6">

            <div>
                <h2 className="text-xl font-light text-white mb-1">
                    Quem é você?
                </h2>
                <p className="text-white/40 text-sm">
                    Sara vai usar isso para personalizar cada resposta.
                </p>
            </div>

            {/* Name input */}
            <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                    Como devo te chamar?
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-4 py-3 rounded-xl
                    bg-white/5 border border-white/10
                    text-white placeholder-white/20
                    focus:outline-none focus:border-white/25
                    text-sm transition-colors"
                    autoFocus
                />
            </div>

            {/* Profession */}
            <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                    Área de atuação
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {PROFESSIONS.map((p) => (
                        <button
                            key={p}
                            onClick={() => setProfession(p)}
                            className={`px-3 py-2.5 rounded-xl text-sm text-left
                         border transition-all
                         ${profession === p
                                    ? 'border-white/30 bg-white/10 text-white'
                                    : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Response style */}
            <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                    Como prefere que eu responda?
                </label>

                <div className="space-y-2">
                    {Object.entries(STYLE_EXAMPLES).map(([key, value]) => (
                        <button
                            key={key}
                            onClick={() => setStyle(key as any)}
                            className={`w-full px-4 py-3 rounded-xl text-left
                         border transition-all
                         ${style === key
                                    ? 'border-white/30 bg-white/10'
                                    : 'border-white/10 hover:border-white/15'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-white font-medium">
                                    {value.label}
                                </span>
                                <span className="text-xs text-white/30">
                                    {value.description}
                                </span>
                            </div>

                            {/* Preview */}
                            <p className="text-xs text-white/30 font-mono leading-relaxed
                           whitespace-pre-line">
                                {value.example}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            <WizardNav
                onNext={handleNext}
                onBack={prevStep}
                nextDisabled={!isValid}
                showBack={false}
            />
        </div>
    );
}
