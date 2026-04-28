import { Phone } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { colors, fontFamily, radii } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function AuthOnboardingScreen() {
  const router = useRouter();
  useOnboardingStep(11, 'auth');

  return (
    <OnboardingScreen step={11} noScroll>
      <View style={styles.main}>
        <OnboardingHeader>Let&apos;s set up your space.</OnboardingHeader>
        <OnboardingBody>
          Your number is encrypted and never shared with anyone. Especially not the guys you check.
        </OnboardingBody>

        <View style={styles.stack}>
          <Pressable onPress={() => router.push('/auth')} style={styles.button}>
            <Phone color={colors.primary} size={18} />
            <Text style={styles.lightLabel}>Continue with phone</Text>
          </Pressable>
          <OnboardingButton label="I already signed in" onPress={() => router.push('/(onboarding)/profile')} />
        </View>
      </View>
      <Text style={styles.micro}>By continuing, you agree to Terms and Privacy.</Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  stack: { marginTop: 16, gap: 12 },
  button: {
    height: 56,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  lightLabel: { color: colors.onSurface, fontFamily: fontFamily.semiBold, fontSize: 16 },
  micro: { textAlign: 'center', color: colors.tertiary, fontFamily: fontFamily.regular, fontSize: 11 },
});
