import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

type Props = { currentStep: number; totalSteps?: number };

export function OnboardingProgressDots({ currentStep, totalSteps = 16 }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const active = index + 1 === currentStep;
        return <View key={index} style={[styles.dot, active && styles.dotActive]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primaryFixed,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
});
