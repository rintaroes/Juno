import { ArrowLeft, PackagePlus, Send } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listCircleMessages, listRosterForTea, sendCircleTextMessage, sendTeaPackageMessage, type CircleMessage } from '../../../lib/circleChat';
import { getSupabase } from '../../../lib/supabase';
import { useAuth } from '../../../providers/AuthProvider';
import { colors, containerMargin, fontFamily, lineHeight, radii, spacing, typeScale } from '../../../theme';

type RosterChoice = { id: string; display_name: string; ai_summary: string | null; notes: string | null };

function timeLabel(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function CircleChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ friendId: string; friendName?: string }>();
  const friendId = Array.isArray(params.friendId) ? params.friendId[0] : params.friendId;
  const friendName = Array.isArray(params.friendName) ? params.friendName[0] : params.friendName;

  const [messages, setMessages] = useState<CircleMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [teaModalOpen, setTeaModalOpen] = useState(false);
  const [rosterOptions, setRosterOptions] = useState<RosterChoice[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [teaNote, setTeaNote] = useState('');
  const [sendingTea, setSendingTea] = useState(false);

  const selectedRoster = useMemo(
    () => rosterOptions.find((r) => r.id === selectedRosterId) ?? null,
    [rosterOptions, selectedRosterId],
  );
  const rosterNeedsScroll = rosterOptions.length > 2;

  const loadMessages = useCallback(async () => {
    if (!friendId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const rows = await listCircleMessages(friendId);
      setMessages(rows);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to load chat.');
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!friendId || !user?.id) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`circle-messages-${user.id}-${friendId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'circle_messages',
        },
        (payload) => {
          const row = payload.new as {
            sender_id?: string;
            recipient_id?: string;
          };
          const a = row.sender_id;
          const b = row.recipient_id;
          const involvesCurrentThread =
            (a === user.id && b === friendId) || (a === friendId && b === user.id);
          if (involvesCurrentThread) {
            void loadMessages();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [friendId, loadMessages, user?.id]);

  const onSendText = useCallback(async () => {
    if (!friendId) return;
    const body = messageInput.trim();
    if (!body) return;
    setSending(true);
    setErrorMsg(null);
    try {
      await sendCircleTextMessage(friendId, body);
      setMessageInput('');
      await loadMessages();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }, [friendId, loadMessages, messageInput]);

  const openTeaModal = useCallback(async () => {
    if (!user) return;
    setErrorMsg(null);
    try {
      const roster = await listRosterForTea(user.id);
      setRosterOptions(roster as RosterChoice[]);
      setSelectedRosterId(roster[0]?.id ?? null);
      setTeaNote('');
      setTeaModalOpen(true);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to load roster.');
    }
  }, [user]);

  const onSendTea = useCallback(async () => {
    if (!friendId || !selectedRosterId) return;
    setSendingTea(true);
    setErrorMsg(null);
    try {
      await sendTeaPackageMessage({
        recipientId: friendId,
        rosterPersonId: selectedRosterId,
        note: teaNote.trim() || undefined,
      });
      setTeaModalOpen(false);
      await loadMessages();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to send tea package.');
    } finally {
      setSendingTea(false);
    }
  }, [friendId, loadMessages, selectedRosterId, teaNote]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            router.back();
          }}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <ArrowLeft color={colors.onSurface} size={20} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {friendName ?? 'Chat'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void openTeaModal();
          }}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <PackagePlus color={colors.onSurface} size={20} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.messagesWrap,
          {
            paddingHorizontal: containerMargin,
          },
        ]}
      >
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        {loading ? <Text style={styles.hint}>Loading messages...</Text> : null}
        {messages.length === 0 ? <Text style={styles.hint}>No messages yet.</Text> : null}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const teaMessage = Boolean(m.tea_package_id);
          return (
            <View key={m.message_id} style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
              {teaMessage ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    router.push({
                      pathname: '/circles/tea/[teaPackageId]',
                      params: { teaPackageId: m.tea_package_id! },
                    });
                  }}
                  style={({ pressed }) => [
                    styles.teaCard,
                    mine ? styles.bubbleMine : styles.bubbleTheirs,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.teaTitle}>Tea Package</Text>
                  <Text style={styles.teaHint}>Tap to view details</Text>
                </Pressable>
              ) : (
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={styles.body}>{m.body}</Text>
                </View>
              )}
              <Text style={styles.time}>{timeLabel(m.created_at)}</Text>
            </View>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}
      >
        <View style={[styles.composeBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            value={messageInput}
            onChangeText={setMessageInput}
            placeholder="Message..."
            placeholderTextColor={colors.outline}
            style={styles.input}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void onSendText();
            }}
            disabled={sending || messageInput.trim().length === 0}
            style={({ pressed }) => [
              styles.sendBtn,
              (sending || messageInput.trim().length === 0) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Send color={colors.onPrimary} size={18} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={teaModalOpen} transparent animationType="slide" onRequestClose={() => setTeaModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Compile Tea Package</Text>
            {rosterOptions.length === 0 ? (
              <>
                <View style={styles.emptyRosterCard}>
                  <Text style={styles.emptyRosterTitle}>No roster entries yet</Text>
                  <Text style={styles.hint}>
                    Add someone to Roster first, then you can compile and send tea packages.
                  </Text>
                </View>
                <View style={styles.modalActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setTeaModalOpen(false)}
                    style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.outlineBtnLabel}>Close</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setTeaModalOpen(false);
                      router.push('/roster/add');
                    }}
                    style={({ pressed }) => [styles.sendTeaBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.sendTeaBtnLabel}>Go to Roster</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Choose a person</Text>
                <View style={[styles.rosterListWrap, rosterNeedsScroll && styles.rosterListWrapScroll]}>
                  <ScrollView
                    scrollEnabled={rosterNeedsScroll}
                    showsVerticalScrollIndicator={rosterNeedsScroll}
                    contentContainerStyle={styles.rosterList}
                  >
                    {rosterOptions.map((r) => (
                      <Pressable
                        key={r.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedRosterId(r.id)}
                        style={({ pressed }) => [
                          styles.rosterRow,
                          selectedRosterId === r.id && styles.rosterRowActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.rosterRowTitle}>{r.display_name}</Text>
                        <Text style={styles.rosterRowHint} numberOfLines={1}>
                          {r.ai_summary ?? r.notes ?? 'No summary yet'}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <TextInput
                  value={teaNote}
                  onChangeText={setTeaNote}
                  placeholder="Optional note..."
                  placeholderTextColor={colors.outline}
                  style={styles.input}
                />
                {selectedRoster ? (
                  <Text style={styles.hint} numberOfLines={2}>
                    Ready to send: {selectedRoster.display_name}
                  </Text>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setTeaModalOpen(false)}
                    style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.outlineBtnLabel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void onSendTea();
                    }}
                    disabled={!selectedRosterId || sendingTea}
                    style={({ pressed }) => [
                      styles.sendTeaBtn,
                      (!selectedRosterId || sendingTea) && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.sendTeaBtnLabel}>
                      {sendingTea ? 'Compiling...' : 'Compile & Send'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    paddingHorizontal: containerMargin,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  topTitle: {
    flex: 1,
    marginHorizontal: spacing.sm,
    textAlign: 'center',
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    color: colors.onSurface,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  messagesWrap: { paddingVertical: spacing.md, gap: spacing.sm },
  msgRow: { maxWidth: '85%', gap: 4 },
  msgRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bubbleMine: { backgroundColor: colors.primaryContainer },
  bubbleTheirs: { backgroundColor: colors.surfaceContainer },
  body: { fontFamily: fontFamily.regular, fontSize: typeScale.bodyMd, color: colors.onSurface },
  teaCard: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  teaTitle: { fontFamily: fontFamily.semiBold, fontSize: typeScale.labelMd, color: colors.onSurface },
  teaHint: { fontFamily: fontFamily.regular, fontSize: typeScale.labelSm, color: colors.onSurfaceVariant },
  time: { fontFamily: fontFamily.regular, fontSize: typeScale.labelSm, color: colors.onSurfaceVariant },
  composeBar: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
    paddingHorizontal: containerMargin,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    color: colors.onSurface,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  error: { fontFamily: fontFamily.medium, fontSize: typeScale.labelMd, color: colors.error },
  hint: { fontFamily: fontFamily.regular, fontSize: typeScale.labelMd, color: colors.onSurfaceVariant },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: containerMargin,
  },
  modalCard: {
    borderRadius: radii.lg,
    maxHeight: '70%',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.sm,
  },
  modalTitle: { fontFamily: fontFamily.semiBold, fontSize: typeScale.titleLg, color: colors.onSurface },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
  },
  rosterListWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rosterListWrapScroll: {
    maxHeight: 180,
  },
  rosterList: {
    padding: spacing.xs,
    gap: spacing.xs,
  },
  rosterRow: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
    backgroundColor: colors.surfaceContainerLowest,
    gap: 2,
  },
  rosterRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  rosterRowTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.onSurface,
  },
  rosterRowHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
  },
  emptyRosterCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  emptyRosterTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.onSurface,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  outlineBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnLabel: { fontFamily: fontFamily.medium, fontSize: typeScale.labelMd, color: colors.onSurface },
  sendTeaBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendTeaBtnLabel: { fontFamily: fontFamily.semiBold, fontSize: typeScale.labelMd, color: colors.onPrimary },
  pressed: { opacity: 0.86 },
});
