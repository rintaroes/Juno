import { ChevronLeft } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../../components/AppDock';
import { lookupRegistry } from '../../lib/api/registry';
import { useAuth } from '../../providers/AuthProvider';
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
} from '../../theme';

const tertiaryFieldBg = 'rgba(227, 225, 238, 0.3)';

export default function RegistryLookupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rosterPersonId?: string | string[] }>();
  const rosterPersonId = Array.isArray(params.rosterPersonId)
    ? params.rosterPersonId[0]
    : params.rosterPersonId;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const dockH = getDockOuterHeight(insets.bottom);
  const topPad = insets.top + spacing.md;

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [age, setAge] = useState('');
  const [dob, setDob] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(async () => {
    if (!user?.id || loading) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Enter at least two characters for the name.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await lookupRegistry({
        name: trimmed,
        city: city.trim() || undefined,
        age: age.trim() ? Number(age.trim()) : undefined,
        dob: dob.trim() || undefined,
        state: stateValue.trim() || undefined,
        zip: zip.trim() || undefined,
        rosterPersonId: rosterPersonId?.trim() || undefined,
      });
      router.push({
        pathname: '/registry/result',
        params: { id: res.registryCheckId },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  }, [age, city, dob, loading, name, router, rosterPersonId, stateValue, user?.id, zip]);

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad,
            paddingBottom: dockH + spacing.lg,
            paddingHorizontal: containerMargin,
          },
        ]}
      >
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ChevronLeft color={colors.primary} size={28} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Registry check</Text>
          <View style={styles.backSpacer} />
        </View>

        <Text style={styles.lead}>
          Search by name. Add age, state, or zip to narrow results. Lookup runs on our servers; your
          search stays private.
          {rosterPersonId ? ' This check will be linked to the open roster profile.' : ''}
        </Text>

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Legal name"
            placeholderTextColor={colors.tertiary}
            autoCapitalize="words"
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>City (optional)</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Brooklyn"
            placeholderTextColor={colors.tertiary}
            autoCapitalize="words"
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>Age (optional)</Text>
          <TextInput
            value={age}
            onChangeText={setAge}
            placeholder="e.g. 32"
            placeholderTextColor={colors.tertiary}
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>Date of birth (optional)</Text>
          <TextInput
            value={dob}
            onChangeText={setDob}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.tertiary}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>State (optional)</Text>
          <TextInput
            value={stateValue}
            onChangeText={(t) => setStateValue(t.toUpperCase())}
            placeholder="e.g. NY"
            placeholderTextColor={colors.tertiary}
            maxLength={2}
            autoCapitalize="characters"
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>ZIP (optional)</Text>
          <TextInput
            value={zip}
            onChangeText={setZip}
            placeholder="e.g. 11201"
            placeholderTextColor={colors.tertiary}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => void onSubmit()}
          disabled={loading}
          style={({ pressed }) => [
            styles.primaryBtn,
            ambientBtn,
            pressed && styles.pressed,
            loading && styles.primaryDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryLabel}>Run registry check</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          Dev tip: use a name containing &quot;demo_match&quot; for a sample possible match, or
          &quot;demo_error&quot; for an error path.
        </Text>
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
    alignItems: 'stretch',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: tertiaryFieldBg,
  },
  backSpacer: {
    width: 44,
  },
  pressed: {
    opacity: 0.88,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.25),
    color: colors.primary,
  },
  lead: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.45),
    color: colors.onSurfaceVariant,
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurfaceVariant,
  },
  labelSpaced: {
    marginTop: spacing.sm,
  },
  input: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.bodyMd,
    color: colors.primary,
    backgroundColor: tertiaryFieldBg,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    minHeight: 52,
  },
  primaryDisabled: {
    opacity: 0.65,
  },
  primaryLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    color: colors.onPrimary,
  },
  hint: {
    marginTop: spacing.lg,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.4),
    color: colors.tertiary,
  },
});
