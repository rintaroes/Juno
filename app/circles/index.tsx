import { Settings } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../../components/AppDock';
import { listCircleThreads, type CircleThread } from '../../lib/circleChat';
import { colors, containerMargin, fontFamily, getDockOuterHeight, lineHeight, radii, spacing, typeScale } from '../../theme';

function relativeTimeLabel(ts: string | null) {
  if (!ts) return '';
  const delta = Date.now() - new Date(ts).getTime();
  const min = Math.floor(delta / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ts).toLocaleDateString();
}

export default function CirclesInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<CircleThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const dockH = useMemo(() => getDockOuterHeight(insets.bottom), [insets.bottom]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listCircleThreads();
      setRows(data);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to load chats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: dockH + spacing.lg,
            paddingHorizontal: containerMargin,
          },
        ]}
      >
        <View style={styles.topRow}>
          <Text style={styles.title}>Circles</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.push('/circles/settings');
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Settings color={colors.onSurface} size={20} strokeWidth={2} />
          </Pressable>
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        {loading ? <Text style={styles.hint}>Loading chats...</Text> : null}

        {rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.hint}>
              Add friends in Settings, then open a thread and send a message or tea package.
            </Text>
          </View>
        ) : (
          rows.map((row) => (
            <Pressable
              key={row.friend_id}
              accessibilityRole="button"
              onPress={() => {
                router.push({
                  pathname: '/circles/chat/[friendId]',
                  params: {
                    friendId: row.friend_id,
                    friendName: row.friend_name,
                  },
                });
              }}
              style={({ pressed }) => [styles.threadRow, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {row.friend_name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.threadMain}>
                <View style={styles.threadTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.friend_name}
                  </Text>
                  <Text style={styles.time}>{relativeTimeLabel(row.last_message_at)}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {row.last_message_preview ?? 'Start a conversation'}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
      <AppDock />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  scroll: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.headlineMd,
    lineHeight: lineHeight(typeScale.headlineMd, 1.25),
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
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryFixed,
  },
  avatarText: { fontFamily: fontFamily.bold, fontSize: typeScale.labelMd, color: colors.primary },
  threadMain: { flex: 1, minWidth: 0, gap: 2 },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontFamily: fontFamily.semiBold, fontSize: typeScale.bodyMd, color: colors.onSurface },
  time: { fontFamily: fontFamily.regular, fontSize: typeScale.labelSm, color: colors.onSurfaceVariant },
  preview: { fontFamily: fontFamily.regular, fontSize: typeScale.labelMd, color: colors.onSurfaceVariant },
  emptyCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: { fontFamily: fontFamily.semiBold, fontSize: typeScale.titleLg, color: colors.onSurface },
  hint: { fontFamily: fontFamily.regular, fontSize: typeScale.labelMd, color: colors.onSurfaceVariant },
  error: { fontFamily: fontFamily.medium, fontSize: typeScale.labelMd, color: colors.error },
  pressed: { opacity: 0.86 },
});
