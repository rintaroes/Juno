import { useFocusEffect, useRouter } from 'expo-router';
import { Archive, Pencil, Plus, UserRound } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../../components/AppDock';
import { ScreenGradient } from '../../components/ui/ScreenGradient';
import { listRosterPeople, type RosterPerson } from '../../lib/roster';
import { rosterAvatarColor, rosterInitials } from '../../lib/rosterPresentation';
import { useAuth } from '../../providers/AuthProvider';
import {
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

function formatSecondary(person: RosterPerson) {
  const bits: string[] = [];
  if (person.estimated_age != null) bits.push(`Age ${person.estimated_age}`);
  if (person.state) bits.push(person.state.toUpperCase());
  if (person.zip) bits.push(person.zip);
  return bits.join(' • ');
}

export default function RosterListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const dockH = useMemo(() => getDockOuterHeight(insets.bottom), [insets.bottom]);

  const [rows, setRows] = useState<RosterPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) return;
      setError(null);
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await listRosterPeople(user.id, showArchived);
        setRows(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load roster.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showArchived, user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenGradient />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: dockH + spacing.md,
            paddingHorizontal: containerMargin,
          },
        ]}
        refreshControl={
          <RefreshControl
            tintColor={colors.cta}
            refreshing={refreshing}
            onRefresh={() => {
              void load(true);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Roster</Text>
            <Text style={styles.subtitle}>
              Keep private notes and context on people you have checked.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              router.push('/roster/add');
            }}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Plus size={18} color={colors.onPrimary} strokeWidth={2.4} />
            <Text style={styles.addBtnLabel}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.segment}>
          <Pressable
            onPress={() => {
              setShowArchived(false);
            }}
            style={({ pressed }) => [
              styles.segmentHalf,
              !showArchived && styles.segmentHalfActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.segmentLabel, !showArchived && styles.segmentLabelActive]}>
              Active
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowArchived(true);
            }}
            style={({ pressed }) => [
              styles.segmentHalf,
              showArchived && styles.segmentHalfActive,
              pressed && styles.pressed,
            ]}
          >
            <Archive
              size={16}
              color={showArchived ? colors.white : colors.meta}
              strokeWidth={2}
            />
            <Text style={[styles.segmentLabel, showArchived && styles.segmentLabelActive]}>
              Archived
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.cta} />
            <Text style={styles.loadingText}>Loading roster...</Text>
          </View>
        ) : error ? (
          <View style={[styles.panelCard, ambientCard]}>
            <Text style={styles.emptyTitle}>Could not load your roster</Text>
            <Text style={styles.emptyBody}>{error}</Text>
            <Pressable
              onPress={() => {
                void load();
              }}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.retryLabel}>Try again</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={[styles.panelCard, ambientCard]}>
            <View style={styles.emptyIconWrap}>
              <UserRound size={22} color={colors.cta} strokeWidth={2.2} />
            </View>
            <Text style={styles.emptyTitle}>Your roster is empty</Text>
            <Text style={styles.emptyBody}>
              Add someone manually now. Registry and image lookup results will attach here in later
              phases.
            </Text>
            <Pressable
              onPress={() => {
                router.push('/roster/add');
              }}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
            >
              <Text style={styles.primaryActionLabel}>Add first person</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((person) => {
              const secondary = formatSecondary(person);
              const notesLine = person.notes?.trim()
                ? person.notes
                : 'No notes yet.';
              return (
                <Pressable
                  key={person.id}
                  onPress={() => {
                    router.push(`/roster/${person.id}`);
                  }}
                  style={({ pressed }) => [styles.rowCard, ambientCard, pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: rosterAvatarColor(person.id) },
                    ]}
                  >
                    <Text style={styles.avatarText}>{rosterInitials(person.display_name)}</Text>
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {person.display_name}
                    </Text>
                    {secondary ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {secondary}
                      </Text>
                    ) : null}
                    <Text style={styles.rowNotes} numberOfLines={2}>
                      {notesLine}
                    </Text>
                  </View>
                  <Pencil color={colors.cta} size={20} strokeWidth={1.75} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <AppDock />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fontFamily.displayItalic,
    fontSize: typeScale.headlineLg,
    lineHeight: lineHeight(typeScale.headlineLg, 1.12),
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.meta,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cta,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...Platform.select({
      ios: {
        shadowColor: colors.ctaShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  addBtnLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onPrimary,
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  segmentHalfActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  segmentLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.meta,
  },
  segmentLabelActive: {
    color: colors.white,
  },
  loadingWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.meta,
  },
  panelCard: {
    marginTop: spacing.xs,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.meta,
    textAlign: 'center',
  },
  primaryAction: {
    marginTop: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.cta,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryActionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onPrimary,
  },
  retryBtn: {
    marginTop: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: colors.surfaceSecondary,
  },
  retryLabel: {
    fontFamily: fontFamily.medium,
    color: colors.ink,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  rowCard: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.white,
    letterSpacing: 0.3,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.35),
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.meta,
  },
  rowNotes: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.meta,
    fontStyle: 'italic',
  },
  pressed: {
    opacity: 0.9,
  },
});
