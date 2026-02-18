
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboardingStore } from '../../stores/onboarding-store';
import { Step1Welcome } from './steps/Step1Welcome';
import { Step2Identity } from './steps/Step2Identity';
import { Step3Budget } from './steps/Step3Budget';
import { Step4Data } from './steps/Step4Data';
import { Step5Pulse } from './steps/Step5Pulse';
import { Step6Awakening } from './steps/Step6Awakening';
import { WizardProgress } from './WizardProgress';

const STEPS = [
    Step1Welcome,
    Step2Identity,
    Step3Budget,
    Step4Data,
    Step5Pulse,
    Step6Awakening
];

export function OnboardingWizard() {
    const { currentStep } = useOnboardingStore();

    const StepComponent = STEPS[currentStep - 1];

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 overflow-hidden">

            {/* Progress bar (hidden on step 1 and 6) */}
            {currentStep > 1 && currentStep < 6 && (
                <div className="w-full max-w-md mb-8">
                    <WizardProgress current={currentStep - 1} total={4} />
                </div>
            )}

            {/* Step content with animation */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="w-full max-w-md"
                >
                    <StepComponent />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
