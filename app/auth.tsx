import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppErrorState } from '../components/AppErrorState';
import { AppLoading } from '../components/AppLoading';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { colors, fontFamily, lineHeight, radii, spacing, typeScale } from '../theme';

type Mode = 'sign_in' | 'sign_up';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromOnboarding?: string; returnTo?: string }>();
  const fromOnboardingRaw = Array.isArray(params.fromOnboarding)
    ? params.fromOnboarding[0]
    : params.fromOnboarding;
  const returnToRaw = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const isFromOnboarding = fromOnboardingRaw === '1';
  const returnTo = returnToRaw || '/(onboarding)/characters/welcome';
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => email.trim().length > 4 && password.length >= 6 && !pending,
    [email, password, pending],
  );

  if (loading) return <AppLoading label="Checking session..." />;
  if (session) return <Redirect href="/map" />;
  if (error) return <AppErrorState message={error} onRetry={() => setError(null)} />;

  const onSubmit = async () => {
    const safeEmail = email.trim().toLowerCase();
    setPending(true);
    setMessage(null);
    try {
      if (mode === 'sign_up') {
        const { error: signUpError, data } = await getSupabase().auth.signUp({
          email: safeEmail,
          password,
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage('Check your email to confirm your account, then sign in.');
        } else {
          setMessage('Account created. Redirecting...');
        }
      } else {
        const { error: signInError } = await getSupabase().auth.signInWithPassword({
          email: safeEmail,
          password,
        });
        if (signInError) throw signInError;
        setMessage('Signed in. Redirecting...');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          bounces
          alwaysBounceVertical
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {isFromOnboarding ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace(returnTo)}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              >
                <ArrowLeft color={colors.onSurface} size={18} strokeWidth={2} />
                <Text style={styles.backLabel}>Back</Text>
              </Pressable>
            ) : null}
            <Text style={styles.brand}>Juno</Text>
            <Text style={styles.title}>
              {mode === 'sign_up' ? 'Create your account' : 'Sign in'}
            </Text>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password (6+ chars)"
              placeholderTextColor={colors.outline}
              style={styles.input}
            />

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.cta,
                (!canSubmit || pending) && styles.ctaDisabled,
                pressed && canSubmit && styles.pressed,
              ]}
            >
              <Text style={styles.ctaLabel}>
                {pending
                  ? 'Working...'
                  : mode === 'sign_up'
                    ? 'Create account'
                    : 'Sign in'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMode((prev) => (prev === 'sign_in' ? 'sign_up' : 'sign_in'));
                setMessage(null);
                setError(null);
              }}
              style={({ pressed }) => [styles.switchMode, pressed && styles.pressed]}
            >
              <Text style={styles.switchModeLabel}>
                {mode === 'sign_in'
                  ? "Don't have an account? Create one"
                  : 'Already have an account? Sign in'}
              </Text>
            </Pressable>

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  backLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
  },
  brand: {
    textAlign: 'center',
    fontFamily: fontFamily.extraBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.2),
    color: colors.indigo500,
    marginBottom: spacing.xs,
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.3),
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  input: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.4),
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  cta: {
    marginTop: spacing.sm,
    minHeight: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.onPrimary,
  },
  switchMode: {
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  switchModeLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.primary,
  },
  message: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.4),
    color: colors.onSurfaceVariant,
  },
  pressed: {
    opacity: 0.85,
  },
});
