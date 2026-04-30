import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { colors, fontFamily, radii } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function SetupAccountScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  useOnboardingStep(10, 'setup_account');
  const canContinue = useMemo(() => email.trim().includes('@'), [email]);

  return (
    <OnboardingScreen step={10} noScroll>
      <View style={styles.main}>
        <OnboardingHeader>Let&apos;s set up your space.</OnboardingHeader>
        <OnboardingBody>Start with your email. We&apos;ll use it to create your Juno account.</OnboardingBody>

        <View style={styles.stack}>
          <View style={styles.inputWrap}>
            <Mail color={colors.tertiary} size={18} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
          </View>
          <OnboardingButton
            label="Continue with email"
            onPress={() =>
              router.push({
                pathname: '/(onboarding)/profile',
                params: { email: email.trim().toLowerCase() },
              })
            }
            disabled={!canContinue}
          />
          <OnboardingButton
            label="I already have an account"
            onPress={() =>
              router.push({
                pathname: '/auth',
                params: {
                  fromOnboarding: '1',
                  returnTo: '/(onboarding)/setup-account',
                },
              })
            }
          />
        </View>
      </View>
      <Text style={styles.micro}>By continuing, you agree to Terms and Privacy.</Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  stack: { marginTop: 16, gap: 12 },
  inputWrap: {
    height: 56,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: colors.onSurface,
  },
  micro: { textAlign: 'center', color: colors.tertiary, fontFamily: fontFamily.regular, fontSize: 11 },
});
