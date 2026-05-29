'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from './useOnboarding';
import type { OnboardingStep } from './onboarding-steps';

interface SpotlightStyle {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

function getElementRect(selector: string | null): {
  rect: DOMRect | null;
  target: HTMLElement | null;
} {
  if (!selector) return { rect: null, target: null };
  try {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return { rect: null, target: null };
    return { rect: el.getBoundingClientRect(), target: el };
  } catch {
    return { rect: null, target: null };
  }
}

function computeSpotlight(rect: DOMRect | null): SpotlightStyle | null {
  if (!rect) return null;
  const pad = 8;
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: Math.max(rect.width, rect.height) > 100 ? 12 : 8,
  };
}

function SpotlightOverlay({
  spotlight,
}: {
  spotlight: SpotlightStyle | null;
}): React.ReactNode {
  if (!spotlight) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/50"
        style={{ pointerEvents: 'auto' }}
      />
    );
  }

  const shadow = '0 0 0 9999px rgba(0, 0, 0, 0.55)';

  return (
    <>
      <div
        className="fixed z-50"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          borderRadius: spotlight.borderRadius,
          boxShadow: shadow,
          pointerEvents: 'auto',
        }}
      />
      <div
        className="fixed z-50"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          borderRadius: spotlight.borderRadius,
          outline: '2px solid rgba(59, 130, 246, 0.6)',
          outlineOffset: 2,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

function getContentStyle(
  placement: OnboardingStep['placement'],
  spotlight: SpotlightStyle | null,
): React.CSSProperties {
  if (placement === 'center' || !spotlight) {
    return {
      position: 'fixed' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 60,
    };
  }

  const base: React.CSSProperties = {
    position: 'fixed' as const,
    zIndex: 60,
  };

  switch (placement) {
    case 'top':
      return {
        ...base,
        top: spotlight.top,
        left: spotlight.left + spotlight.width / 2,
        transform: 'translate(-50%, -100%) translateY(-12px)',
      };
    case 'bottom':
      return {
        ...base,
        top: spotlight.top + spotlight.height,
        left: spotlight.left + spotlight.width / 2,
        transform: 'translate(-50%, 0) translateY(12px)',
      };
    case 'left':
      return {
        ...base,
        top: spotlight.top + spotlight.height / 2,
        left: spotlight.left,
        transform: 'translate(-100%, -50%) translateX(-12px)',
      };
    case 'right':
      return {
        ...base,
        top: spotlight.top + spotlight.height / 2,
        left: spotlight.left + spotlight.width,
        transform: 'translate(0, -50%) translateX(12px)',
      };
    default:
      return base;
  }
}

interface StepContentProps {
  step: OnboardingStep;
  spotlight: SpotlightStyle | null;
  currentIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  isNavigating: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDismiss: () => void;
}

function StepContent({
  step,
  spotlight,
  currentIndex,
  totalSteps,
  isFirst,
  isLast,
  isNavigating,
  onPrev,
  onNext,
  onDismiss,
}: StepContentProps): React.ReactNode {
  const contentStyle = getContentStyle(step.placement, spotlight);

  return (
    <div
      className="fixed z-[60] w-72 rounded-xl border bg-background p-4 shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{ ...contentStyle, pointerEvents: 'auto' }}
    >
      <div className="mb-2 flex items-start justify-between">
        <h3 className="text-sm font-semibold">{step.title}</h3>
        <button
          onClick={onDismiss}
          className="ml-4 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isNavigating ? (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading page...
        </div>
      ) : (
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Step {currentIndex + 1} of {totalSteps}
        </span>
        <div className="flex gap-1">
          {!isFirst && !isNavigating && (
            <Button variant="ghost" size="sm" onClick={onPrev}>
              <ArrowLeft className="mr-1 h-3 w-3" />
              Prev
            </Button>
          )}
          <Button
            size="sm"
            onClick={isLast ? onDismiss : onNext}
            disabled={isNavigating}
          >
            {isLast ? 'Done' : 'Next'}
            {!isLast && <ArrowRight className="ml-1 h-3 w-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingTour(): React.ReactNode {
  const {
    isActive,
    currentStep,
    totalSteps,
    goNext,
    goPrev,
    dismissTour,
    steps,
  } = useOnboarding();
  const router = useRouter();
  const pathname = usePathname();
  const [spotlight, setSpotlight] = useState<SpotlightStyle | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const rafRef = useRef<number>(0);
  const prevStepRef = useRef(currentStep);

  const step = steps[currentStep] as OnboardingStep | undefined;

  const updateSpotlight = useCallback(() => {
    if (!isActive || !step) return;
    const { rect } = getElementRect(step.targetSelector);
    setSpotlight(computeSpotlight(rect));
  }, [isActive, step]);

  useEffect(() => {
    if (!isActive) return;
    updateSpotlight();

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateSpotlight);
    };

    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);

    const interval = setInterval(updateSpotlight, 3000);

    return () => {
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      clearInterval(interval);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, updateSpotlight]);

  useEffect(() => {
    updateSpotlight();
  }, [currentStep, updateSpotlight]);

  useEffect(() => {
    if (!isActive || !step) return;

    if (step.route && step.route !== pathname && !isNavigating) {
      setIsNavigating(true);
      router.push(step.route);
    }
    return undefined;
  }, [isActive, step, pathname, isNavigating, router]);

  useEffect(() => {
    if (isNavigating && step?.route && step.route === pathname) {
      const timeout = setTimeout(() => {
        setIsNavigating(false);
        updateSpotlight();
      }, 500);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [isNavigating, step?.route, pathname, updateSpotlight]);

  useEffect(() => {
    prevStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissTour();
      if (isNavigating) return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, dismissTour, goNext, goPrev, isNavigating]);

  if (!isActive || !step) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }}>
      <SpotlightOverlay spotlight={isNavigating ? null : spotlight} />
      <StepContent
        key={step.id}
        step={step}
        spotlight={isNavigating ? null : spotlight}
        currentIndex={currentStep}
        totalSteps={totalSteps}
        isFirst={isFirst}
        isLast={isLast}
        isNavigating={isNavigating}
        onPrev={goPrev}
        onNext={goNext}
        onDismiss={dismissTour}
      />
    </div>
  );
}
