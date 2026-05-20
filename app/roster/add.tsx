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
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { ScreenGradient } from '../../components/ui/ScreenGradient';
import { createRosterPerson } from '../../lib/roster';
import { useAuth } from '../../providers/AuthProvider';
import {
  ambientCard,
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
      <StatusBar style="dark" />
      <ScreenGradient />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + spacing.sm,
              paddingBottom: spacing.xl * 2,
              paddingHorizontal: containerMargin,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => {
                router.back();
              }}
              style={({ pressed }) => [styles.backIconBtn, pressed && styles.pressed]}
            >
              <ChevronLeft size={24} color={colors.ink} strokeWidth={1.75} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Add person</Text>
            <Text style={styles.subtitle}>Create a private roster profile manually.</Text>
          </View>

          <View style={[styles.formCard, ambientCard]}>
            <Text style={styles.cardTitle}>Details</Text>
            <View style={styles.form}>
              <Field label="Display name *">
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="e.g. Alex Mercer"
                  placeholderTextColor={colors.meta}
                  style={styles.input}
                />
              </Field>
              <Field label="Estimated age">
                <TextInput
                  value={estimatedAge}
                  onChangeText={setEstimatedAge}
                  placeholder="e.g. 31"
                  placeholderTextColor={colors.meta}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </Field>
              <Field label="Date of birth (YYYY-MM-DD)">
                <TextInput
                  value={dob}
                  onChangeText={setDob}
                  placeholder="1995-05-14"
                  placeholderTextColor={colors.meta}
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
                      placeholderTextColor={colors.meta}
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
                      placeholderTextColor={colors.meta}
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
                  placeholder="Anything useful to remember…"
                  placeholderTextColor={colors.meta}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.notesInput]}
                />
              </Field>
            </View>
          </View>

          <Button
            label="Save person"
            loading={saving}
            disabled={!isValid || saving}
            onPress={() => {
              void onSave();
            }}
          />
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
    backgroundColor: colors.paper,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  backIconBtn: {
    width: 44,
    height: 44,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: typeScale.headlineLg,
    lineHeight: lineHeight(typeScale.headlineLg, 1.12),
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.45),
    color: colors.meta,
  },
  formCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: typeScale.titleLg,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: colors.meta,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    color: colors.ink,
  },
  notesInput: {
    minHeight: 120,
  },
  inline: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineCell: {
    flex: 1,
  },
  pressed: {
    opacity: 0.88,
  },
});
