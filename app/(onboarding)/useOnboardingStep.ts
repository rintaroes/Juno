import { useEffect } from 'react';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { useOnboardingStore } from '../../stores/onboardingStore';

export function useOnboardingStep(step: number, name: string) {
  const setCurrentStep = useOnboardingStore((state) => state.setCurrentStep);
  useEffect(() => {
    setCurrentStep(step);
    void trackOnboardingEvent('onboarding_screen_view', { step, name });
  }, [name, setCurrentStep, step]);
}
