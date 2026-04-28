import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

const reasons = [
  'I match a lot on dating apps',
  'First dates make me nervous',
  'My friends and I want a better way to look out for each other',
  'Something happened to me or someone I know',
  'I just want to feel safer day to day',
];

export default function WhyHereScreen() {
  const router = useRouter();
  const selectedReasons = useOnboardingStore((state) => state.selectedReasons);
  const toggleReason = useOnboardingStore((state) => state.toggleReason);
  const clearReasons = useOnboardingStore((state) => state.clearReasons);
  useOnboardingStep(4, 'why_here');

  useEffect(() => {
    clearReasons();
  }, [clearReasons]);

  return (
    <OnboardingScreen step={4}>
      <View style={styles.main}>
        <OnboardingHeader>What brings you to Juno?</OnboardingHeader>
        <OnboardingBody>Pick everything that fits. We&apos;ll personalize what comes next.</OnboardingBody>
        <View style={styles.reasonList}>
          {reasons.map((reason) => {
            const selected = selectedReasons.includes(reason);
            return (
              <Pressable
                key={reason}
                style={[styles.reasonCard, selected && styles.reasonCardSelected]}
                onPress={() => {
                  toggleReason(reason);
                  void trackOnboardingEvent('onboarding_reason_toggled', { reason, selected: !selected });
                }}
              >
                <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{reason}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <OnboardingButton
        label="Continue"
        disabled={selectedReasons.length < 1}
        onPress={() => router.push('/(onboarding)/characters/problem')}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  reasonList: { gap: 12, marginTop: 8 },
  reasonCard: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryFixedDim,
  },
  reasonCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryContainer,
  },
  reasonText: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.onPrimaryContainer,
    textAlign: 'center',
  },
  reasonTextSelected: {
    color: colors.onPrimary,
  },
});
