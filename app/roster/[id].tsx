import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, ChevronLeft, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
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
import { listChatUploads, type ChatUpload } from '../../lib/chatUploads';
import {
  listRegistryChecksForRoster,
  type RegistryCheck,
} from '../../lib/registryChecks';
import { getSupabase } from '../../lib/supabase';
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
  const [chatUploads, setChatUploads] = useState<ChatUpload[]>([]);
  const [registryChecks, setRegistryChecks] = useState<RegistryCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingChat, setUploadingChat] = useState(false);
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

  const loadChatUploads = async (ownerId: string, rosterPersonId: string) => {
    const data = await listChatUploads(ownerId, rosterPersonId);
    setChatUploads(data);
  };

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
        await loadChatUploads(user.id, data.id);
        const regRows = await listRegistryChecksForRoster(user.id, data.id);
        setRegistryChecks(regRows);
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

  const onUploadChatScreenshot = async () => {
    if (!user?.id || !id || !person || uploadingChat) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'Allow photo library access to upload chat screenshots.',
      );
      return;
    }

    const pickResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });

    if (pickResult.canceled || pickResult.assets.length === 0) {
      return;
    }

    const asset = pickResult.assets[0];
    setUploadingChat(true);
    try {
      const uri = asset.uri;
      const ext =
        (asset.fileName?.split('.').pop() || uri.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${person.id}/${Date.now()}.${ext}`;
        const base64 = asset.base64?.trim();
        if (!base64) {
          throw new Error(
            'Selected image did not include base64 data. Please try another screenshot.',
          );
        }
        const fileBytes = Buffer.from(base64, 'base64');
        if (!fileBytes.byteLength) {
          throw new Error(
            'Selected image resolved to 0 bytes. Please re-screenshot and try again.',
          );
        }

        const { error: uploadError } = await getSupabase()
          .storage
          .from('chat-screenshots')
          .upload(path, fileBytes, {
            upsert: false,
            contentType: asset.mimeType ?? 'image/jpeg',
          });
        if (uploadError) throw uploadError;

        const { error: functionError } = await getSupabase().functions.invoke(
          'summarize-chat-screenshot',
          {
            body: { rosterPersonId: person.id, screenshotPath: path },
          },
        );
        if (functionError) {
          let detail = functionError.message;
          const maybeContext = (
            functionError as { context?: { json?: () => Promise<unknown> } }
          ).context;
          if (maybeContext?.json) {
            try {
              const payload = (await maybeContext.json()) as { error?: string };
              if (payload?.error) detail = payload.error;
            } catch {
              // Ignore context parse failures and fall back to default message.
            }
          }
          throw new Error(detail);
        }

        await loadChatUploads(user.id, person.id);
        Alert.alert('Summary ready', 'Chat screenshot analyzed and saved.');
      } catch (e) {
        Alert.alert(
          'Upload failed',
          e instanceof Error ? e.message : 'Unable to process screenshot.',
        );
      } finally {
        setUploadingChat(false);
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

              <View style={styles.chatSection}>
                <Text style={styles.chatSectionTitle}>Registry checks</Text>
                <Text style={styles.chatSectionHint}>
                  Linked lookups from Protect. Each registry result requires explicit confirmation
                  before it is attached here.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/registry/lookup',
                      params: { rosterPersonId: id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.chatUploadBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.chatUploadLabel}>Run registry check</Text>
                </Pressable>
                {registryChecks.length === 0 ? (
                  <Text style={styles.chatEmptyText}>No registry checks linked yet.</Text>
                ) : (
                  <View style={styles.chatList}>
                    {registryChecks.map((c) => (
                      <View key={c.id} style={styles.chatCard}>
                        <Text style={styles.chatCardMeta}>
                          {new Date(c.created_at).toLocaleString()} ·{' '}
                          {c.status.replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.chatSummaryText}>
                          Query: {c.query_name}
                          {c.query_state ? ` · ${c.query_state}` : ''}
                          {c.query_zip ? ` · ${c.query_zip}` : ''}
                        </Text>
                        {c.matched_name ? (
                          <Text style={styles.chatOpeningLine}>
                            Top match: {c.matched_name}
                            {c.matched_state ? ` · ${c.matched_state}` : ''}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.chatSection}>
                <Text style={styles.chatSectionTitle}>Chat Screenshot Summaries</Text>
                <Text style={styles.chatSectionHint}>
                  Upload a dating app or iMessage screenshot to extract OCR and AI context.
                </Text>
                <Pressable
                  disabled={uploadingChat}
                  onPress={() => {
                    void onUploadChatScreenshot();
                  }}
                  style={({ pressed }) => [
                    styles.chatUploadBtn,
                    uploadingChat && styles.saveBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {uploadingChat ? (
                    <>
                      <ActivityIndicator color={colors.onPrimary} />
                      <Text style={styles.chatUploadLabel}>Analyzing screenshot...</Text>
                    </>
                  ) : (
                    <Text style={styles.chatUploadLabel}>Add Chat Screenshot</Text>
                  )}
                </Pressable>

                {chatUploads.length === 0 ? (
                  <Text style={styles.chatEmptyText}>No chat screenshots yet.</Text>
                ) : (
                  <View style={styles.chatList}>
                    {chatUploads.map((entry) => (
                      <View key={entry.id} style={styles.chatCard}>
                        <Text style={styles.chatCardMeta}>
                          {new Date(entry.created_at).toLocaleString()}
                        </Text>
                        {entry.opening_line ? (
                          <Text style={styles.chatOpeningLine}>
                            Opening line: {entry.opening_line}
                          </Text>
                        ) : null}
                        <Text style={styles.chatSummaryText}>
                          {entry.ai_summary ?? 'No summary generated.'}
                        </Text>
                        <FlagList title="Red flags" items={entry.red_flags} />
                        <FlagList title="Green flags" items={entry.green_flags} />
                      </View>
                    ))}
                  </View>
                )}
              </View>

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

function FlagList({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.flagBlock}>
      <Text style={styles.flagTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.flagEmpty}>None detected.</Text>
      ) : (
        items.map((item, index) => (
          <Text key={`${title}-${index}`} style={styles.flagRow}>
            - {item}
          </Text>
        ))
      )}
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
  chatSection: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  chatSectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    color: colors.onSurface,
  },
  chatSectionHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.onSurfaceVariant,
  },
  chatUploadBtn: {
    marginTop: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexDirection: 'row',
    paddingVertical: 12,
  },
  chatUploadLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onPrimary,
  },
  chatEmptyText: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    color: colors.onSurfaceVariant,
  },
  chatList: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  chatCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.sm,
    gap: 4,
  },
  chatCardMeta: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.tertiary,
  },
  chatOpeningLine: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
  },
  chatSummaryText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.onSurfaceVariant,
  },
  flagBlock: {
    marginTop: 4,
    gap: 2,
  },
  flagTitle: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.onSurface,
  },
  flagEmpty: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
  },
  flagRow: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
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
