import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function TeaScreen() {
  const router = useRouter();
  useOnboardingStep(10, 'tea');
  return (
    <OnboardingScreen step={10}>
      <View style={styles.main}>
        <OnboardingHeader>Send the tea - privately.</OnboardingHeader>
        <OnboardingBody>
          Found a red flag? Spotted a catfish? Know a guy your friend&apos;s about to meet? Send a Tea
          Package and only your circle sees it. No screenshots, no awkward DMs.
        </OnboardingBody>
        <View style={styles.card}>
          <Text style={styles.label}>From: Sarah</Text>
          <Text style={styles.label}>To: Maya, Coco, Ella</Text>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>Heads up about Liam - see attached.</Text>
          </View>
        </View>
      </View>
      <OnboardingButton label="Sounds about right" onPress={() => router.push('/(onboarding)/auth')} />
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  card: { borderWidth: 1, borderColor: colors.stone, borderRadius: 20, padding: 16, gap: 10 },
  label: { fontFamily: fontFamily.inter, color: colors.charcoal, fontSize: 14 },
  summary: { borderRadius: 14, borderWidth: 1, borderColor: colors.outlineVariant, padding: 12 },
  summaryText: { fontFamily: fontFamily.inter, color: colors.stone, fontSize: 13 },
});
