
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingData {
    // Step 2
    name: string;
    profession: string;
    responseStyle: 'direct' | 'analytic' | 'socratic';

    // Step 3
    dailyBudget: number;
    allowEmergency: boolean;

    // Step 4
    uploadedFiles: UploadedFile[];

    // Step 5
    firstPulseCompleted: boolean;
    firstInsight?: string;
}

export interface UploadedFile {
    name: string;
    type: string;
    size: number;
    atomsCreated: number;
}

export interface PulseLog {
    timestamp: Date;
    stage: 'IDLE' | 'REFLEXION' | 'DECIDING' | 'ACTION' | 'SYNTHESIS' | 'OUTPUT';
    message: string;
    detail?: string;
}

interface OnboardingStore {
    // State
    currentStep: number;
    isCompleted: boolean;
    isProcessing: boolean;
    data: Partial<OnboardingData>;
    pulseLogs: PulseLog[];

    // Actions
    setStep: (step: number) => void;
    nextStep: () => void;
    prevStep: () => void;
    updateData: (data: Partial<OnboardingData>) => void;
    addPulseLog: (log: PulseLog) => void;
    completeOnboarding: () => void;
    resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
    persist(
        (set) => ({
            currentStep: 1,
            isCompleted: false,
            isProcessing: false,
            data: {},
            pulseLogs: [],

            setStep: (step) => set({ currentStep: step }),

            nextStep: () => set(state => ({
                currentStep: Math.min(state.currentStep + 1, 6)
            })),

            prevStep: () => set(state => ({
                currentStep: Math.max(state.currentStep - 1, 1)
            })),

            updateData: (data) => set(state => ({
                data: { ...state.data, ...data }
            })),

            addPulseLog: (log) => set(state => ({
                pulseLogs: [...state.pulseLogs, log]
            })),

            completeOnboarding: () => set({ isCompleted: true }),

            resetOnboarding: () => set({
                currentStep: 1,
                isCompleted: false,
                data: {},
                pulseLogs: []
            })
        }),
        {
            name: 'sara-onboarding',
            partialize: (state) => ({
                isCompleted: state.isCompleted,
                data: state.data
            })
        }
    )
);
