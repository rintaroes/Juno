import { Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { startSubscriptionTrial } from '../../lib/subscriptions';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

const rows = [
  'Unlimited registry checks',
  'Reverse image search on every match',
  'Add up to 5 friends to your circle',
  'Date mode with auto check-ins',
  'Tea packages + AI summaries',
];

export default function PaywallScreen() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const selectedTier = useOnboardingStore((state) => state.selectedTier);
  const setSelectedTier = useOnboardingStore((state) => state.setSelectedTier);
  const markCompleted = useOnboardingStore((state) => state.markCompleted);
  useOnboardingStep(16, 'paywall');

  const finish = async () => {
    await markCompleted();
    router.replace('/');
  };

  return (
    <OnboardingScreen step={16}>
      <View style={styles.main}>
        <OnboardingHeader size={36}>Keep going.</OnboardingHeader>
        <Text style={styles.sub}>
          Unlimited checks. Your full circle. Date mode. Tea packages. Less than your morning
          coffee.
        </Text>
        <View style={styles.tierRow}>
          <TierCard tier="annual" selected={selectedTier === 'annual'} onPress={setSelectedTier} />
          <TierCard tier="monthly" selected={selectedTier === 'monthly'} onPress={setSelectedTier} />
        </View>
        <Text style={styles.includes}>WHAT&apos;S INCLUDED</Text>
        <View style={styles.rowList}>
          {rows.map((row) => (
            <View key={row} style={styles.featureRow}>
              <Check size={14} color={colors.stone} />
              <Text style={styles.featureLabel}>{row}</Text>
            </View>
          ))}
        </View>
      </View>
      <View>
        <OnboardingButton
          label={pending ? 'Starting trial...' : 'Start free trial'}
          onPress={() => {
            setPending(true);
            void trackOnboardingEvent('onboarding_paywall_trial_tap', { selectedTier });
            void startSubscriptionTrial(selectedTier)
              .then(async () => {
                await finish();
                void trackOnboardingEvent('onboarding_paywall_converted', { selectedTier });
              })
              .catch(() => {})
              .finally(() => setPending(false));
          }}
          disabled={pending}
        />
        <Text style={styles.micro}>Cancel anytime. No charge until your trial ends.</Text>
        <OnboardingButton variant="ghost" label="Continue with limited access" onPress={() => void finish()} />
      </View>
    </OnboardingScreen>
  );
}

function TierCard({
  tier,
  selected,
  onPress,
}: {
  tier: 'annual' | 'monthly';
  selected: boolean;
  onPress: (tier: 'annual' | 'monthly') => void;
}) {
  return (
    <Pressable style={[styles.tierCard, selected && styles.tierSelected]} onPress={() => onPress(tier)}>
      {tier === 'annual' ? <Text style={styles.pill}>BEST VALUE - SAVE $80</Text> : null}
      <Text style={styles.price}>{tier === 'annual' ? '$99/year' : '$14.99/month'}</Text>
      <Text style={styles.tierSub}>
        {tier === 'annual' ? '$8.25/mo · billed annually' : 'Billed monthly'}
      </Text>
      {tier === 'annual' ? <Text style={styles.trial}>7-day free trial</Text> : null}
      {selected ? <View style={styles.check} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 14 },
  sub: { fontFamily: fontFamily.inter, color: colors.stone, fontSize: 16, lineHeight: 22 },
  tierRow: { flexDirection: 'row', gap: 16 },
  tierCard: { flex: 1, borderWidth: 1, borderColor: colors.stone, borderRadius: 20, padding: 12, minHeight: 160, gap: 6 },
  tierSelected: { borderWidth: 2, borderColor: colors.coral },
  pill: { backgroundColor: colors.sienna, color: colors.cream, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontFamily: fontFamily.interMedium, fontSize: 10, alignSelf: 'flex-start' },
  price: { fontFamily: fontFamily.fraunces, fontSize: 24, color: colors.charcoal },
  tierSub: { fontFamily: fontFamily.inter, fontSize: 13, color: colors.stone },
  trial: { fontFamily: fontFamily.inter, fontSize: 12, color: colors.sienna },
  check: { position: 'absolute', top: 10, right: 10, width: 14, height: 14, borderRadius: 999, backgroundColor: colors.coral },
  includes: { fontFamily: fontFamily.interMedium, fontSize: 11, letterSpacing: 0.8, color: colors.stone },
  rowList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureLabel: { fontFamily: fontFamily.inter, fontSize: 14, color: colors.charcoal },
  micro: { textAlign: 'center', color: colors.stone, fontFamily: fontFamily.inter, fontSize: 11, marginTop: 8 },
});
