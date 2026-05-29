'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { MAP_ONBOARDING_STEPS } from './onboarding-steps';
import type { OnboardingStep } from './onboarding-steps';

export interface OnboardingContextValue {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  isComplete: boolean;
  steps: OnboardingStep[];
  startTour: () => void;
  dismissTour: () => void;
  goNext: () => void;
  goPrev: () => void;
  goToStep: (idx: number) => void;
  tourFinished: boolean;
  markTourFinished: () => void;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(
  null,
);

interface OnboardingProviderProps {
  children: ReactNode;
  steps?: OnboardingStep[];
  storageKey?: string;
}

export function OnboardingProvider({
  children,
  steps = MAP_ONBOARDING_STEPS,
  storageKey = 'gavai_onboarding_map_complete',
}: OnboardingProviderProps): ReactNode {
  const initialized = useRef(false);
  const [isComplete, setIsComplete] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) === 'true';
    }
    return true;
  });
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourFinished, setTourFinished] = useState(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!isComplete) {
      setIsActive(true);
    }
  }, [isComplete]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    setTourFinished(false);
  }, []);

  const dismissTour = useCallback(() => {
    setIsActive(false);
    setIsComplete(true);
    localStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const markTourFinished = useCallback(() => {
    setTourFinished(true);
    setIsActive(false);
    setIsComplete(true);
    localStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const goNext = useCallback(() => {
    setCurrentStep((s) => {
      const next = s + 1;
      if (next >= steps.length) {
        markTourFinished();
        return s;
      }
      return next;
    });
  }, [steps.length, markTourFinished]);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const goToStep = useCallback(
    (idx: number) => {
      setCurrentStep(Math.max(0, Math.min(idx, steps.length - 1)));
    },
    [steps.length],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isActive,
      currentStep,
      totalSteps: steps.length,
      isComplete,
      steps,
      startTour,
      dismissTour,
      goNext,
      goPrev,
      goToStep,
      tourFinished,
      markTourFinished,
    }),
    [
      isActive,
      currentStep,
      isComplete,
      steps,
      startTour,
      dismissTour,
      goNext,
      goPrev,
      goToStep,
      tourFinished,
      markTourFinished,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
