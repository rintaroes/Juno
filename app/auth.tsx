import { useMemo, useState, type ComponentProps } from 'react';
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
import { ChevronLeft } from 'lucide-react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppErrorState } from '../components/AppErrorState';
import { AppLoading } from '../components/AppLoading';
import { Button } from '../components/ui/Button';
import { ScreenGradient } from '../components/ui/ScreenGradient';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import {
  colors,
  containerMargin,
  fontFamily,
  lineHeight,
  radii,
  spacing,
  typeScale,
} from '../theme';

type Mode = 'sign_in' | 'sign_up';

function AuthField({
  label,
  ...inputProps
}: {
  label: string;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.meta}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const isSignIn = mode === 'sign_in';

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

  const onBack = () => {
    if (isFromOnboarding) {
      router.replace(returnTo);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  const showBack = isFromOnboarding || router.canGoBack();

  const toggleMode = () => {
    setMode((prev) => (prev === 'sign_in' ? 'sign_up' : 'sign_in'));
    setMessage(null);
    setError(null);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenGradient />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View
          style={[
            styles.shell,
            {
              paddingTop: insets.top + spacing.sm,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          <View style={styles.topBar}>
            {showBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={12}
                onPress={onBack}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              >
                <ChevronLeft color={colors.ink} size={24} strokeWidth={1.75} />
              </Pressable>
            ) : (
              <View style={styles.backPlaceholder} />
            )}
            <Text style={styles.wordmark}>Juno</Text>
            <View style={styles.backPlaceholder} />
          </View>

          <ScrollView
            bounces
            alwaysBounceVertical
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{isSignIn ? 'Sign in' : 'Create account'}</Text>
            <Text style={styles.subtitle}>Please enter your details.</Text>

            <View style={styles.form}>
              <AuthField
                label="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
              />
              <AuthField
                label="Password"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                textContentType={isSignIn ? 'password' : 'newPassword'}
                value={password}
                onChangeText={setPassword}
                placeholder="Password (6+ characters)"
              />

              <View style={styles.ctaWrap}>
                <Button
                  label={isSignIn ? 'Sign in' : 'Create account'}
                  disabled={!canSubmit}
                  loading={pending}
                  onPress={onSubmit}
                />
              </View>

              {message ? <Text style={styles.message}>{message}</Text> : null}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isSignIn ? "Don't have an account? " : 'Already have an account? '}
              <Text
                accessibilityRole="link"
                onPress={toggleMode}
                style={styles.footerLink}
              >
                {isSignIn ? 'Create one' : 'Sign in'}
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  keyboardAvoid: {
    flex: 1,
  },
  shell: {
    flex: 1,
    zIndex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: containerMargin,
    minHeight: 44,
    marginBottom: spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  backPlaceholder: {
    width: 44,
    height: 44,
  },
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamily.display,
    fontSize: typeScale.wordmark,
    lineHeight: lineHeight(typeScale.wordmark, 1.15),
    color: colors.ink,
    pointerEvents: 'none',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: containerMargin,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: typeScale.headlineLg,
    lineHeight: lineHeight(typeScale.headlineLg, 1.1),
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.45),
    color: colors.inkBody,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.3),
    color: colors.ink,
  },
  input: {
    width: '100%',
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.4),
    color: colors.ink,
    backgroundColor: colors.card,
  },
  ctaWrap: {
    marginTop: spacing.sm,
  },
  message: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.45),
    color: colors.meta,
  },
  footer: {
    paddingHorizontal: containerMargin,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.45),
    color: colors.inkBody,
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: fontFamily.semiBold,
    color: colors.cta,
  },
  pressed: {
    opacity: 0.88,
  },
});
