import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, HeartHandshake, ImagePlus, MapPinned } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../components/AppDock';
import { lookupRegistry } from '../lib/api/registry';
import { useAuth } from '../providers/AuthProvider';
import {
  ambientBtn,
  ambientCard,
  colors,
  containerMargin,
  fontFamily,
  getDockOuterHeight,
  lineHeight,
  radii,
  spacing,
  typeScale,
} from '../theme';

const tertiaryFieldBg = 'rgba(227, 225, 238, 0.3)';

export default function ProtectScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [optState, setOptState] = useState('');
  const [optZip, setOptZip] = useState('');
  const [optDob, setOptDob] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [dbCheck, setDbCheck] = useState<
    'idle' | { ok: true } | { ok: false; message: string }
  >('idle');

  const dockH = getDockOuterHeight(insets.bottom);
  const topPad = insets.top + spacing.md;

  const onRunCheck = useCallback(async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const ct = city.trim();
    if (!fn || !ln) {
      Alert.alert('Add a name', 'Please enter both first and last name.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Sign in required', 'Sign in to run a safety check.');
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await lookupRegistry({
        name: `${fn} ${ln}`.trim(),
        city: ct || undefined,
        state: optState.trim() || undefined,
        zip: optZip.trim() || undefined,
        dob: optDob.trim() || undefined,
      });
      router.push({
        pathname: '/registry/result',
        params: { id: res.registryCheckId },
      });
    } catch (e) {
      Alert.alert(
        'Check failed',
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setVerifyLoading(false);
    }
  }, [city, firstName, lastName, optDob, optState, optZip, router, user?.id]);

  const onUploadPress = useCallback(() => {
    console.log('upload screenshot tap');
  }, []);

  const onSignOut = useCallback(() => {
    void signOut().catch((e) => {
      console.log('sign out failed', e);
    });
  }, [signOut]);

  useEffect(() => {
    setDbCheck('idle');
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad,
            paddingBottom: dockH + spacing.md,
            paddingHorizontal: containerMargin,
          },
        ]}
      >
        <View style={styles.column}>
          <Text style={styles.brand}>Juno</Text>

          <Text accessibilityRole="header" style={styles.heroTitle}>
            Safety Check
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onUploadPress}
            style={({ pressed }) => [
              styles.uploadCard,
              ambientCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.uploadIconWrap}>
              <ImagePlus color={colors.primary} size={27} strokeWidth={2} />
            </View>
            <Text style={styles.uploadTitle}>Upload screenshot</Text>
            <Text style={styles.uploadHint}>Optional · PNG or JPG up to 10MB</Text>
          </Pressable>

          <View style={[styles.formCard, ambientCard]}>
            <View style={styles.nameRow}>
              <View style={styles.nameHalf}>
                <Text nativeID="labelFirst" style={styles.fieldLabel}>
                  First name
                </Text>
                <TextInput
                  accessibilityLabelledBy="labelFirst"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Alex"
                  placeholderTextColor={colors.tertiary}
                  autoCapitalize="words"
                  style={styles.fieldInput}
                />
              </View>
              <View style={styles.nameHalf}>
                <Text nativeID="labelLast" style={styles.fieldLabel}>
                  Last name
                </Text>
                <TextInput
                  accessibilityLabelledBy="labelLast"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Mercer"
                  placeholderTextColor={colors.tertiary}
                  autoCapitalize="words"
                  style={styles.fieldInput}
                />
              </View>
            </View>

            <Text nativeID="labelCity" style={[styles.fieldLabel, styles.labelSpaced]}>
              City or neighborhood (optional)
            </Text>
            <View style={styles.cityWrap}>
              <View style={styles.cityIcon} pointerEvents="none">
                <MapPinned color={colors.tertiary} size={20} strokeWidth={2} />
              </View>
              <TextInput
                accessibilityLabelledBy="labelCity"
                value={city}
                onChangeText={setCity}
                placeholder="Brooklyn"
                placeholderTextColor={colors.tertiary}
                style={[styles.fieldInput, styles.cityInput]}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showOptional }}
              onPress={() => setShowOptional((v) => !v)}
              style={({ pressed }) => [styles.optionalToggle, pressed && styles.pressed]}
            >
              <Text style={styles.optionalToggleLabel}>More to narrow results</Text>
              <ChevronDown
                color={colors.onSurfaceVariant}
                size={20}
                strokeWidth={2}
                style={{
                  transform: [{ rotate: showOptional ? '180deg' : '0deg' }],
                }}
              />
            </Pressable>

            {showOptional ? (
              <View style={styles.optionalBlock}>
                <Text nativeID="labelState" style={styles.fieldLabel}>
                  State (optional)
                </Text>
                <TextInput
                  accessibilityLabelledBy="labelState"
                  value={optState}
                  onChangeText={(t) => setOptState(t.toUpperCase())}
                  placeholder="NY"
                  placeholderTextColor={colors.tertiary}
                  maxLength={2}
                  autoCapitalize="characters"
                  style={styles.fieldInput}
                />
                <Text nativeID="labelZip" style={[styles.fieldLabel, styles.labelSpaced]}>
                  ZIP (optional)
                </Text>
                <TextInput
                  accessibilityLabelledBy="labelZip"
                  value={optZip}
                  onChangeText={setOptZip}
                  placeholder="11201"
                  placeholderTextColor={colors.tertiary}
                  keyboardType="number-pad"
                  style={styles.fieldInput}
                />
                <Text nativeID="labelDob" style={[styles.fieldLabel, styles.labelSpaced]}>
                  Date of birth (optional)
                </Text>
                <TextInput
                  accessibilityLabelledBy="labelDob"
                  value={optDob}
                  onChangeText={setOptDob}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.tertiary}
                  style={styles.fieldInput}
                />
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={verifyLoading}
            onPress={() => void onRunCheck()}
            style={({ pressed }) => [
              styles.gradientOuter,
              ambientBtn,
              pressed && styles.gradientPressed,
              verifyLoading && styles.gradientDisabled,
            ]}
          >
            <LinearGradient
              colors={[colors.primaryContainer, colors.primary]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.gradientInner}
            >
              {verifyLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <HeartHandshake color={colors.onPrimary} size={21} strokeWidth={2} />
                  <Text style={styles.verifyLabel}>Run safety check</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.disclaimer}>
            Registry results may include similar names. We never notify the person you search.
          </Text>

          {__DEV__ && dbCheck !== 'idle' ? (
            <Text style={styles.dbSmoke} accessibilityLabel="Supabase debug status">
              {dbCheck.ok === true
                ? 'Supabase: profiles + roster_people OK'
                : `Supabase: ${dbCheck.message}`}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onSignOut}
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
          >
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AppDock />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: 448,
    alignItems: 'center',
    gap: spacing.lg,
  },
  brand: {
    fontFamily: fontFamily.extraBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.2),
    color: colors.indigo500,
    letterSpacing: -0.35,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.headlineMd,
    lineHeight: lineHeight(typeScale.headlineMd, 1.25),
    letterSpacing: -0.24,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  uploadCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryFixed,
    borderStyle: 'dashed',
    paddingVertical: 24,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.35),
    color: colors.primary,
    textAlign: 'center',
  },
  uploadHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.4),
    color: colors.tertiary,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameHalf: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    letterSpacing: 0.12,
    color: colors.onSurfaceVariant,
    marginBottom: 6,
  },
  labelSpaced: {
    marginTop: spacing.md,
  },
  fieldInput: {
    width: '100%',
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    color: colors.onSurface,
    backgroundColor: tertiaryFieldBg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cityWrap: {
    position: 'relative',
    width: '100%',
  },
  cityIcon: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  cityInput: {
    paddingLeft: 44,
  },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  optionalToggleLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.primary,
  },
  optionalBlock: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  gradientOuter: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  gradientInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    minHeight: 52,
  },
  gradientPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  gradientDisabled: {
    opacity: 0.72,
  },
  verifyLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.35),
    color: colors.onPrimary,
  },
  disclaimer: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.35),
    color: colors.tertiary,
    textAlign: 'center',
    maxWidth: 320,
    alignSelf: 'center',
    opacity: 0.75,
    paddingHorizontal: spacing.sm,
  },
  dbSmoke: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.35),
    color: colors.tertiary,
    textAlign: 'center',
    alignSelf: 'center',
    opacity: 0.55,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  signOutBtn: {
    marginTop: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  signOutLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
  },
  pressed: {
    opacity: 0.88,
  },
});
