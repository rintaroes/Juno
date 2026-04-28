import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

const cards = [
  { label: 'Run a check', body: 'Search his record. See his real socials.' },
  { label: 'Share your location', body: 'With the friends you actually trust.' },
  { label: 'Send the tea', body: 'Share what you find with your circle.' },
];

export default function PitchScreen() {
  const router = useRouter();
  useOnboardingStep(2, 'pitch');

  return (
    <OnboardingScreen step={2}>
      <View style={styles.main}>
        <OnboardingHeader size={32}>
          Check him before you meet him.{'\n'}Watch each other while you&apos;re out.{'\n'}Spill the tea after.
        </OnboardingHeader>
        <OnboardingBody>Three things every group chat should be doing - finally in one app.</OnboardingBody>
        <View style={styles.cardList}>
          {cards.map(({ label, body }, index) => (
            <View key={label} style={styles.card}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{index + 1}</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={styles.cardBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <OnboardingButton label="Continue" onPress={() => router.push('/(onboarding)/proof')} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  cardList: { gap: 12, marginTop: 8, paddingBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamily.semiBold,
    color: colors.primary,
    fontSize: 14,
  },
  cardText: { flex: 1, gap: 4 },
  cardLabel: { fontFamily: fontFamily.semiBold, color: colors.onSurface, fontSize: 15 },
  cardBody: { fontFamily: fontFamily.regular, color: colors.tertiary, fontSize: 14, lineHeight: 20 },
});
