import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { Button, type ButtonVariant } from '../ui/Button';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
};

export function OnboardingButton({ label, onPress, disabled, loading, variant = 'primary' }: Props) {
  const mapped: ButtonVariant = variant === 'ghost' ? 'ghost' : 'primary';

  return (
    <Button
      label={label}
      variant={mapped}
      disabled={disabled}
      loading={loading}
      onPress={() => {
        void trackOnboardingEvent('onboarding_cta_tap', { label, variant });
        onPress();
      }}
    />
  );
}
