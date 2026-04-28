import { Check, TriangleAlert } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function CheckScreen() {
  const router = useRouter();
  useOnboardingStep(8, 'check');
  return (
    <OnboardingScreen step={8}>
      <View style={styles.main}>
        <OnboardingHeader>Check anyone in 30 seconds.</OnboardingHeader>
        <OnboardingBody>
          Type his name. We search the registry, find his real social profiles, and tell you what
          you need to know - before your first date, not after.
        </OnboardingBody>
        <View style={styles.mock}>
          <View style={styles.topRow}>
            <View style={styles.avatar} />
            <Text style={styles.name}>Marcus, 28</Text>
          </View>
          <View style={styles.itemRow}>
            <Check size={16} color={colors.stone} />
            <Text style={styles.itemText}>Verified - photos appear authentic</Text>
          </View>
          <View style={styles.itemRow}>
            <Check size={16} color={colors.stone} />
            <Text style={styles.itemText}>No criminal record found</Text>
          </View>
          <View style={styles.itemRow}>
            <TriangleAlert size={16} color={colors.sienna} />
            <Text style={styles.itemText}>Also appears on Bumble under &apos;Mark M.&apos;</Text>
          </View>
          <Text style={styles.reco}>Recommendation: Ask him about the second profile.</Text>
        </View>
        <Text style={styles.micro}>Results based on public information. Always trust your instincts.</Text>
      </View>
      <OnboardingButton label="Continue" onPress={() => router.push('/(onboarding)/date-mode')} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  mock: { borderWidth: 1, borderColor: colors.stone, borderRadius: 20, padding: 16, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 999, backgroundColor: colors.outlineVariant },
  name: { fontFamily: fontFamily.interMedium, fontSize: 15, color: colors.charcoal },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemText: { fontFamily: fontFamily.inter, color: colors.charcoal, fontSize: 14, flex: 1 },
  reco: { marginTop: 6, fontFamily: fontFamily.inter, fontSize: 13, color: colors.stone },
  micro: { fontFamily: fontFamily.inter, fontSize: 12, color: colors.stone },
});
