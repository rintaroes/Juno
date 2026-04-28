import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

const entries = [
  { name: 'Marcus, 28', status: 'Verified' },
  { name: 'Jake, 31', status: 'Needs review' },
  { name: 'Liam, 26', status: 'Saved' },
];

export default function RosterScreen() {
  const router = useRouter();
  useOnboardingStep(7, 'roster');
  return (
    <OnboardingScreen step={7}>
      <View style={styles.main}>
        <OnboardingHeader>Your roster lives here.</OnboardingHeader>
        <OnboardingBody>
          Every guy you&apos;ve matched with, talked to, or had a date with - saved in one place.
          With his record, his real socials, and your notes. So you actually remember which Jake is
          which.
        </OnboardingBody>
        <View style={styles.mockCard}>
          {entries.map((entry) => (
            <View key={entry.name} style={styles.row}>
              <View style={styles.avatar} />
              <Text style={styles.name}>{entry.name}</Text>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{entry.status}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <OnboardingButton label="Continue" onPress={() => router.push('/(onboarding)/check')} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  mockCard: { borderWidth: 1, borderColor: colors.stone, borderRadius: 20, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 999, backgroundColor: colors.outlineVariant },
  name: { flex: 1, color: colors.charcoal, fontFamily: fontFamily.interMedium, fontSize: 15 },
  pill: { borderRadius: 999, backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fontFamily.inter, fontSize: 12, color: colors.stone },
});
