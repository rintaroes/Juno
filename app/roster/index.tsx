import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, UserRound } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../../components/AppDock';
import { listRosterPeople, type RosterPerson } from '../../lib/roster';
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

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
      <ScrollView
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
            tintColor={colors.primary}
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
            <Text style={styles.brand}>Juno</Text>
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

        <Pressable
          onPress={() => {
            setShowArchived((prev) => !prev);
          }}
          style={({ pressed }) => [
            styles.filterBtn,
            showArchived && styles.filterBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.filterBtnLabel,
              showArchived && styles.filterBtnLabelActive,
            ]}
          >
            {showArchived ? 'Showing archived entries' : 'Showing active entries'}
          </Text>
        </Pressable>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading roster...</Text>
          </View>
        ) : error ? (
          <View style={[styles.emptyCard, ambientCard]}>
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
          <View style={[styles.emptyCard, ambientCard]}>
            <View style={styles.emptyIconWrap}>
              <UserRound size={22} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={styles.emptyTitle}>Your roster is empty</Text>
            <Text style={styles.emptyBody}>
              Add someone manually now. Registry and image lookup results will attach
              here in later phases.
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
              return (
                <Pressable
                  key={person.id}
                  onPress={() => {
                    router.push(`/roster/${person.id}`);
                  }}
                  style={({ pressed }) => [
                    styles.rowCard,
                    ambientCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(person.display_name)}</Text>
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {person.display_name}
                    </Text>
                    {secondary ? (
                      <Text style={styles.rowSecondary} numberOfLines={1}>
                        {secondary}
                      </Text>
                    ) : null}
                    <Text style={styles.rowNotes} numberOfLines={2}>
                      {person.notes?.trim()
                        ? person.notes
                        : 'No notes yet. Tap to add context.'}
                    </Text>
                  </View>
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
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleWrap: {
    flex: 1,
  },
  brand: {
    fontFamily: fontFamily.extraBold,
    fontSize: typeScale.bodyLg,
    color: colors.indigo500,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.headlineMd,
    lineHeight: lineHeight(typeScale.headlineMd, 1.2),
    color: colors.primary,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.onSurfaceVariant,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onPrimary,
  },
  filterBtn: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterBtnActive: {
    borderColor: colors.primaryContainer,
    backgroundColor: colors.primaryFixed,
  },
  filterBtnLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
  },
  filterBtnLabelActive: {
    color: colors.primary,
  },
  loadingWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.onSurfaceVariant,
  },
  emptyCard: {
    marginTop: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceContainerLowest,
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
    color: colors.onSurface,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  primaryAction: {
    marginTop: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
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
  },
  retryLabel: {
    fontFamily: fontFamily.medium,
    color: colors.onSurface,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  rowCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.bodyMd,
    color: colors.primary,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    color: colors.onSurface,
  },
  rowSecondary: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
  },
  rowNotes: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.onSurfaceVariant,
  },
  pressed: {
    opacity: 0.88,
  },
});
