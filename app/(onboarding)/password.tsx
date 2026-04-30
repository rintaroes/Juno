import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { ensureProfileForUser, getSupabase } from '../../lib/supabase';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function PasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; firstName?: string }>();
  const email = Array.isArray(params.email) ? params.email[0] ?? '' : params.email ?? '';
  const firstName = Array.isArray(params.firstName) ? params.firstName[0] ?? '' : params.firstName ?? '';
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useOnboardingStep(12, 'password');

  const canContinue = useMemo(
    () => email.trim().includes('@') && password.length >= 6 && !pending,
    [email, password, pending],
  );

  const onContinue = async () => {
    if (!canContinue) return;
    setPending(true);
    setErrorMsg(null);
    try {
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      if (data.user) {
        await ensureProfileForUser(data.user);
        await getSupabase()
          .from('profiles')
          .update({
            first_name: firstName || null,
          })
          .eq('id', data.user.id);
      }
      void trackOnboardingEvent('onboarding_signup_complete');
      router.push('/(onboarding)/circle');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to create account.');
    } finally {
      setPending(false);
    }
  };

  return (
    <OnboardingScreen step={12}>
      <View style={styles.main}>
        <OnboardingHeader>Set a password</OnboardingHeader>
        <TextInput
          style={styles.input}
          placeholder="Password (6+ characters)"
          placeholderTextColor={colors.stone}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
        />
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      </View>
      <OnboardingButton
        label={pending ? 'Creating account...' : 'Create account'}
        onPress={() => void onContinue()}
        disabled={!canContinue}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 12 },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone,
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
    fontFamily: fontFamily.inter,
    fontSize: 16,
    color: colors.charcoal,
  },
  error: { fontFamily: fontFamily.inter, color: colors.error, fontSize: 13 },
});
