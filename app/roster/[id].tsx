import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, ChevronLeft, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
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
import {
  deleteRosterPerson,
  getRosterPerson,
  setRosterArchived,
  updateRosterPerson,
  type RosterPerson,
} from '../../lib/roster';
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

function toForm(person: RosterPerson) {
  return {
    displayName: person.display_name,
    estimatedAge: person.estimated_age == null ? '' : String(person.estimated_age),
    dob: person.dob ?? '',
    stateValue: person.state ?? '',
    zip: person.zip ?? '',
    notes: person.notes ?? '',
  };
}

export default function RosterPersonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [person, setPerson] = useState<RosterPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    estimatedAge: '',
    dob: '',
    stateValue: '',
    zip: '',
    notes: '',
  });

  const isArchived = person?.archived_at != null;
  const canSave = useMemo(() => form.displayName.trim().length > 1, [form.displayName]);

  useEffect(() => {
    const run = async () => {
      if (!user?.id || !id) return;
      setLoading(true);
      try {
        const data = await getRosterPerson(user.id, id);
        if (!data) {
          Alert.alert('Not found', 'This roster entry does not exist anymore.');
          router.replace('/roster');
          return;
        }
        setPerson(data);
        setForm(toForm(data));
      } catch (e) {
        Alert.alert('Could not load person', e instanceof Error ? e.message : 'Try again.');
        router.replace('/roster');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id, router, user?.id]);

  const onSave = async () => {
    if (!user?.id || !id || !canSave || saving) return;
    setSaving(true);
    try {
      const updated = await updateRosterPerson(user.id, id, {
        display_name: form.displayName,
        estimated_age: form.estimatedAge.trim() ? Number(form.estimatedAge) : null,
        dob: form.dob.trim() || null,
        state: form.stateValue,
        zip: form.zip,
        notes: form.notes,
      });
      setPerson(updated);
      setForm(toForm(updated));
      Alert.alert('Saved', 'Roster person updated.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onToggleArchive = () => {
    if (!user?.id || !id || saving) return;
    Alert.alert(
      isArchived ? 'Restore this person?' : 'Archive this person?',
      isArchived
        ? 'This person will return to your active roster.'
        : 'Archived people are hidden from active roster by default.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isArchived ? 'Restore' : 'Archive',
          style: 'default',
          onPress: () => {
            void (async () => {
              setSaving(true);
              try {
                await setRosterArchived(user.id, id, !isArchived);
                const latest = await getRosterPerson(user.id, id);
                if (latest) {
                  setPerson(latest);
                  setForm(toForm(latest));
                }
              } catch (e) {
                Alert.alert(
                  'Could not update archive',
                  e instanceof Error ? e.message : 'Please try again.',
                );
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ],
    );
  };

  const onDelete = () => {
    if (!user?.id || !id || saving) return;
    Alert.alert(
      'Delete person?',
      'This permanently removes this roster profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSaving(true);
              try {
                await deleteRosterPerson(user.id, id);
                router.replace('/roster');
              } catch (e) {
                Alert.alert(
                  'Could not delete',
                  e instanceof Error ? e.message : 'Please try again.',
                );
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ],
    );
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
          showsVerticalScrollIndicator={false}
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

          {loading ? (
            <Text style={styles.metaText}>Loading...</Text>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Person Profile</Text>
                <Text style={styles.subtitle}>
                  Edit this private profile, update notes, archive, or delete.
                </Text>
                <Text style={styles.metaText}>
                  Source: {person?.source ?? 'manual'} {isArchived ? '• archived' : ''}
                </Text>
              </View>

              <View style={styles.form}>
                <Field label="Display name *">
                  <TextInput
                    value={form.displayName}
                    onChangeText={(value) => {
                      setForm((prev) => ({ ...prev, displayName: value }));
                    }}
                    placeholder="e.g. Alex Mercer"
                    placeholderTextColor={colors.outline}
                    style={styles.input}
                  />
                </Field>

                <Field label="Estimated age">
                  <TextInput
                    value={form.estimatedAge}
                    onChangeText={(value) => {
                      setForm((prev) => ({ ...prev, estimatedAge: value }));
                    }}
                    keyboardType="number-pad"
                    placeholder="e.g. 31"
                    placeholderTextColor={colors.outline}
                    style={styles.input}
                  />
                </Field>

                <Field label="Date of birth (YYYY-MM-DD)">
                  <TextInput
                    value={form.dob}
                    onChangeText={(value) => {
                      setForm((prev) => ({ ...prev, dob: value }));
                    }}
                    placeholder="1995-05-14"
                    placeholderTextColor={colors.outline}
                    style={styles.input}
                  />
                </Field>

                <View style={styles.inline}>
                  <View style={styles.inlineCell}>
                    <Field label="State">
                      <TextInput
                        value={form.stateValue}
                        onChangeText={(value) => {
                          setForm((prev) => ({ ...prev, stateValue: value }));
                        }}
                        autoCapitalize="characters"
                        maxLength={2}
                        placeholder="WA"
                        placeholderTextColor={colors.outline}
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  <View style={styles.inlineCell}>
                    <Field label="ZIP">
                      <TextInput
                        value={form.zip}
                        onChangeText={(value) => {
                          setForm((prev) => ({ ...prev, zip: value }));
                        }}
                        keyboardType="number-pad"
                        placeholder="98101"
                        placeholderTextColor={colors.outline}
                        style={styles.input}
                      />
                    </Field>
                  </View>
                </View>

                <Field label="Notes">
                  <TextInput
                    value={form.notes}
                    onChangeText={(value) => {
                      setForm((prev) => ({ ...prev, notes: value }));
                    }}
                    multiline
                    textAlignVertical="top"
                    placeholder="Private notes"
                    placeholderTextColor={colors.outline}
                    style={[styles.input, styles.notesInput]}
                  />
                </Field>
              </View>

              <Pressable
                disabled={!canSave || saving}
                onPress={() => {
                  void onSave();
                }}
                style={({ pressed }) => [
                  styles.saveBtn,
                  (!canSave || saving) && styles.saveBtnDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveLabel}>{saving ? 'Saving...' : 'Save changes'}</Text>
              </Pressable>

              <View style={styles.secondaryActions}>
                <Pressable
                  onPress={onToggleArchive}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                >
                  <Archive size={16} color={colors.onSurface} strokeWidth={2.2} />
                  <Text style={styles.secondaryLabel}>
                    {isArchived ? 'Restore from archive' : 'Archive person'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onDelete}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    styles.deleteBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Trash2 size={16} color={colors.error} strokeWidth={2.2} />
                  <Text style={styles.deleteLabel}>Delete person</Text>
                </Pressable>
              </View>
            </>
          )}
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
  metaText: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.tertiary,
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
  secondaryActions: {
    gap: spacing.xs,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    paddingVertical: 11,
  },
  secondaryLabel: {
    fontFamily: fontFamily.medium,
    color: colors.onSurface,
  },
  deleteBtn: {
    borderColor: colors.errorContainer,
    backgroundColor: colors.errorContainer,
  },
  deleteLabel: {
    fontFamily: fontFamily.medium,
    color: colors.error,
  },
  pressed: {
    opacity: 0.88,
  },
});
