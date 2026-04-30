import { MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function DateModeScreen() {
  const router = useRouter();
  useOnboardingStep(9, 'date_mode');
  return (
    <OnboardingScreen step={9}>
      <View style={styles.main}>
        <OnboardingHeader>Going on a date tonight?</OnboardingHeader>
        <OnboardingBody>
          Tap &apos;I&apos;m on a date.&apos; Pick him from your roster. Set a timer. Your circle sees who
          you&apos;re with, where you are, and gets pinged if you don&apos;t check in.
        </OnboardingBody>
        <View style={styles.mock}>
          <View style={styles.mapPreview}>
            <MapPin size={18} color={colors.coral} />
          </View>
          <Text style={styles.name}>Marcus, 28</Text>
          <Text style={styles.timer}>2:14:32</Text>
          <Text style={styles.caption}>Your circle is watching</Text>
        </View>
      </View>
      <OnboardingButton label="Continue" onPress={() => router.push('/(onboarding)/auth')} />
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  mock: { borderWidth: 1, borderColor: colors.stone, borderRadius: 20, padding: 16, gap: 8 },
  mapPreview: { height: 90, borderRadius: 14, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fontFamily.interMedium, color: colors.charcoal, fontSize: 15 },
  timer: { fontFamily: fontFamily.inter, color: colors.stone, fontSize: 14 },
  caption: { fontFamily: fontFamily.inter, color: colors.stone, fontSize: 13 },
});
