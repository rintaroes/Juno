import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, ChevronLeft, ImagePlus, Trash2 } from 'lucide-react-native';
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
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { ScreenGradient } from '../../components/ui/ScreenGradient';
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
import { rosterAvatarColor, rosterInitials } from '../../lib/rosterPresentation';
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

  const heroName = (form.displayName.trim() || person?.display_name || 'Roster entry').trim();
  const heroKey = person?.id ?? '';

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

          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={colors.cta} size="large" />
              <Text style={styles.metaText}>Loading profile…</Text>
            </View>
          ) : (
            <>
              <View style={styles.hero}>
                <View
                  style={[
                    styles.heroAvatar,
                    { backgroundColor: rosterAvatarColor(heroKey) },
                  ]}
                >
                  <Text style={styles.heroAvatarText}>{rosterInitials(heroName)}</Text>
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroName} numberOfLines={2}>
                    {heroName}
                  </Text>
                  <Text style={styles.heroMeta}>
                    {person?.source === 'manual' || !person?.source
                      ? 'Added manually'
                      : `Source: ${person.source}`}
                    {isArchived ? ' · Archived' : ''}
                  </Text>
                  {isArchived ? (
                    <View style={styles.archivedChip}>
                      <Text style={styles.archivedChipLabel}>Archived</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Text style={styles.lead}>
                Private to you — update details, notes, and linked checks anytime.
              </Text>

              <View style={[styles.formCard, ambientCard]}>
                <Text style={styles.cardTitle}>Details</Text>
                <View style={styles.form}>
                  <Field label="Display name *">
                    <TextInput
                      value={form.displayName}
                      onChangeText={(value) => {
                        setForm((prev) => ({ ...prev, displayName: value }));
                      }}
                      placeholder="e.g. Alex Mercer"
                      placeholderTextColor={colors.meta}
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
                      placeholderTextColor={colors.meta}
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
                      placeholderTextColor={colors.meta}
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
                          placeholderTextColor={colors.meta}
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
                          placeholderTextColor={colors.meta}
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
                      placeholder="Private notes — tone, boundaries, anything you want to remember."
                      placeholderTextColor={colors.meta}
                      style={[styles.input, styles.notesInput]}
                    />
                  </Field>
                </View>
              </View>

              <Button
                label="Save changes"
                loading={saving}
                disabled={!canSave || saving}
                onPress={() => {
                  void onSave();
                }}
              />

              <View style={[styles.sectionCard, ambientCard]}>
                <Text style={styles.sectionTitle}>Registry checks</Text>
                <Text style={styles.sectionHint}>
                  Linked lookups from Protect. Each registry result requires explicit confirmation
                  before it is attached here.
                </Text>
                <Button
                  variant="outline"
                  label="Run registry check"
                  onPress={() =>
                    router.push({
                      pathname: '/registry/lookup',
                      params: { rosterPersonId: id },
                    })
                  }
                />
                {registryChecks.length === 0 ? (
                  <Text style={styles.chatEmptyText}>No registry checks linked yet.</Text>
                ) : (
                  <View style={styles.chatList}>
                    {registryChecks.map((c) => (
                      <View key={c.id} style={styles.embedCard}>
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

              <View style={[styles.sectionCard, ambientCard]}>
                <Text style={styles.sectionTitle}>Chat screenshot summaries</Text>
                <Text style={styles.sectionHint}>
                  Upload a dating app or iMessage screenshot to extract OCR and AI context.
                </Text>
                <Button
                  variant="outline"
                  label={uploadingChat ? 'Analyzing…' : 'Add chat screenshot'}
                  icon={ImagePlus}
                  loading={uploadingChat}
                  disabled={uploadingChat}
                  onPress={() => {
                    void onUploadChatScreenshot();
                  }}
                />

                {chatUploads.length === 0 ? (
                  <Text style={styles.chatEmptyText}>No chat screenshots yet.</Text>
                ) : (
                  <View style={styles.chatList}>
                    {chatUploads.map((entry) => (
                      <View key={entry.id} style={styles.embedCard}>
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

              <View style={[styles.sectionCard, ambientCard]}>
                <Text style={styles.sectionTitle}>Roster actions</Text>
                <Text style={styles.sectionHint}>
                  Archive hides this person from your active list. Delete removes the profile
                  permanently.
                </Text>
                <Pressable
                  onPress={onToggleArchive}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.actionRow,
                    saving && styles.actionRowDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Archive size={18} color={colors.ink} strokeWidth={2} />
                  <Text style={styles.actionRowLabel}>
                    {isArchived ? 'Restore from archive' : 'Archive person'}
                  </Text>
                </Pressable>
                <View style={styles.actionDivider} />
                <Pressable
                  onPress={onDelete}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.actionRow,
                    styles.actionRowDanger,
                    saving && styles.actionRowDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Trash2 size={18} color={colors.alert} strokeWidth={2} />
                  <Text style={styles.actionRowLabelDanger}>Delete person</Text>
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
  loadingBlock: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    gap: spacing.md,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.headlineMd,
    color: colors.white,
    letterSpacing: 0.5,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroName: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: typeScale.headlineMd,
    lineHeight: lineHeight(typeScale.headlineMd, 1.15),
    color: colors.ink,
    letterSpacing: -0.3,
  },
  heroMeta: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.meta,
  },
  archivedChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  archivedChipLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.meta,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  lead: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.5),
    color: colors.meta,
    marginTop: spacing.xs,
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
  metaText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.meta,
  },
  sectionCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: typeScale.titleLg,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.meta,
  },
  chatEmptyText: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.meta,
  },
  chatList: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  embedCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: 6,
  },
  chatCardMeta: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.meta,
  },
  chatOpeningLine: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.ink,
  },
  chatSummaryText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.inkBody,
  },
  flagBlock: {
    marginTop: 4,
    gap: 2,
  },
  flagTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.ink,
  },
  flagEmpty: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.meta,
  },
  flagRow: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.4),
    color: colors.meta,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.paper,
  },
  actionRowDanger: {
    borderColor: 'rgba(176, 84, 72, 0.35)',
    backgroundColor: colors.riskAttentionBg,
  },
  actionRowDisabled: {
    opacity: 0.45,
  },
  actionRowLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.ink,
  },
  actionRowLabelDanger: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.alert,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: 2,
  },
  pressed: {
    opacity: 0.88,
  },
});
