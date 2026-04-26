import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createRosterPerson } from '../../lib/roster';
import { useAuth } from '../../providers/AuthProvider';
import {
  colors,
  containerMargin,
  fontFamily,
  lineHeight,
  radii,
  spacing,
  typeScale,
} from '../../theme';

export default function AddRosterPersonScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [estimatedAge, setEstimatedAge] = useState('');
  const [dob, setDob] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = useMemo(() => displayName.trim().length > 1, [displayName]);

  const onSave = async () => {
    if (!user?.id || !isValid || saving) return;
    setSaving(true);
    try {
      const created = await createRosterPerson({
        owner_id: user.id,
        display_name: displayName,
        estimated_age: estimatedAge.trim() ? Number(estimatedAge) : null,
        dob: dob.trim() || null,
        state: stateValue,
        zip,
        notes,
      });
      router.replace(`/roster/${created.id}`);
    } catch (e) {
      Alert.alert(
        'Could not save person',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + spacing.md,
              paddingBottom: spacing.xl,
              paddingHorizontal: containerMargin,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              router.back();
            }}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ChevronLeft size={18} color={colors.onSurface} strokeWidth={2.4} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Add Person</Text>
            <Text style={styles.subtitle}>
              Create a private roster profile manually.
            </Text>
          </View>

          <View style={styles.form}>
            <Field label="Display name *">
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Alex Mercer"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </Field>
            <Field label="Estimated age">
              <TextInput
                value={estimatedAge}
                onChangeText={setEstimatedAge}
                placeholder="e.g. 31"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>
            <Field label="Date of birth (YYYY-MM-DD)">
              <TextInput
                value={dob}
                onChangeText={setDob}
                placeholder="1995-05-14"
                placeholderTextColor={colors.outline}
                style={styles.input}
              />
            </Field>
            <View style={styles.inline}>
              <View style={styles.inlineCell}>
                <Field label="State">
                  <TextInput
                    value={stateValue}
                    onChangeText={setStateValue}
                    placeholder="WA"
                    placeholderTextColor={colors.outline}
                    autoCapitalize="characters"
                    maxLength={2}
                    style={styles.input}
                  />
                </Field>
              </View>
              <View style={styles.inlineCell}>
                <Field label="ZIP">
                  <TextInput
                    value={zip}
                    onChangeText={setZip}
                    placeholder="98101"
                    placeholderTextColor={colors.outline}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </Field>
              </View>
            </View>
            <Field label="Notes">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything useful to remember..."
                placeholderTextColor={colors.outline}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.notesInput]}
              />
            </Field>
          </View>

          <Pressable
            disabled={!isValid || saving}
            onPress={() => {
              void onSave();
            }}
            style={({ pressed }) => [
              styles.saveBtn,
              (!isValid || saving) && styles.saveBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.saveLabel}>{saving ? 'Saving...' : 'Save Person'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  backLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.headlineMd,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.onSurfaceVariant,
  },
  form: {
    gap: spacing.sm,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurfaceVariant,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    color: colors.onSurface,
  },
  notesInput: {
    minHeight: 116,
  },
  inline: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineCell: {
    flex: 1,
  },
  saveBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingVertical: 13,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.88,
  },
});
