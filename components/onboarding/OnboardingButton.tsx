import { Pressable, StyleSheet, Text, View } from 'react-native';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { LinearGradient } from 'expo-linear-gradient';
import { ambientBtn, colors, fontFamily, lineHeight, radii, spacing } from '../../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
};

export function OnboardingButton({ label, onPress, disabled, variant = 'primary' }: Props) {
  const firePress = () => {
    void trackOnboardingEvent('onboarding_cta_tap', { label, variant });
    onPress();
  };
  if (variant === 'ghost') {
    return (
      <Pressable disabled={disabled} onPress={firePress} style={({ pressed }) => [pressed && styles.pressed]}>
        <Text style={[styles.ghostLabel, disabled && styles.disabled]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={firePress}
      style={({ pressed }) => [
        styles.primaryOuter,
        ambientBtn,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <LinearGradient
        colors={[colors.primaryContainer, colors.primary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.primaryInner}
      >
        <View>
          <Text style={styles.primaryLabel}>{label}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryOuter: {
    height: 56,
    borderRadius: radii.full,
    overflow: 'hidden',
    width: '100%',
  },
  primaryInner: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.onPrimary,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    lineHeight: lineHeight(16, 1.2),
  },
  ghostLabel: {
    marginTop: spacing.sm,
    color: colors.tertiary,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: lineHeight(14, 1.3),
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  pressed: { opacity: 0.84 },
  disabled: { opacity: 0.5 },
});
