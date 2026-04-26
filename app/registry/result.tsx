import { ChevronLeft, UserRound } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../../components/AppDock';
import type { RegistryMatch } from '../../lib/api/registry';
import {
  getRegistryCheck,
  linkRegistryCheckToRoster,
  type RegistryCheck,
} from '../../lib/registryChecks';
import { createRosterPerson, listRosterPeople, type RosterPerson } from '../../lib/roster';
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

function parseMatches(row: RegistryCheck | null): RegistryMatch[] {
  if (!row?.raw_result || typeof row.raw_result !== 'object') return [];
  const raw = row.raw_result as { vendor?: { matches?: unknown } };
  const m = raw.vendor?.matches;
  if (!Array.isArray(m)) return [];
  return m.filter(
    (x): x is RegistryMatch =>
      x != null &&
      typeof x === 'object' &&
      typeof (x as RegistryMatch).name === 'string',
  );
}

function hasMugshot(m: RegistryMatch) {
  return Boolean(m.mugshotUrl?.trim());
}

function sortMatchesWithPhotosFirst(list: RegistryMatch[]) {
  return [...list].sort((a, b) => {
    const ap = hasMugshot(a);
    const bp = hasMugshot(b);
    if (ap !== bp) return ap ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function statusLabel(status: string) {
  switch (status) {
    case 'clear':
      return 'No obvious registry hits';
    case 'possible_match':
      return 'Possible match — review carefully';
    case 'match':
      return 'Strong similarity — verify identity';
    case 'error':
      return 'Lookup could not complete';
    default:
      return status;
  }
}

export default function RegistryResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const dockH = getDockOuterHeight(insets.bottom);
  const topPad = insets.top + spacing.md;

  const [row, setRow] = useState<RegistryCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const matches = useMemo(() => parseMatches(row), [row]);
  const sortedMatches = useMemo(
    () => sortMatchesWithPhotosFirst(matches),
    [matches],
  );

  useEffect(() => {
    const run = async () => {
      if (!user?.id || !id) return;
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getRegistryCheck(user.id, id);
        if (!data) {
          setLoadError('This result was not found.');
          setRow(null);
          return;
        }
        setRow(data);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not load result.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id, user?.id]);

  const disclaimer =
    (row?.raw_result as { vendor?: { disclaimer?: string } } | null)?.vendor?.disclaimer ??
    'Results may include people with the same or similar name.';

  const queryCity = (
    row?.raw_result as { input?: { city?: string | null } } | null | undefined
  )?.input?.city?.trim();

  const openMerge = useCallback(async () => {
    if (!user?.id) return;
    try {
      const people = await listRosterPeople(user.id, false);
      setRoster(people);
      setMergeOpen(true);
    } catch {
      setRoster([]);
      setMergeOpen(true);
    }
  }, [user?.id]);

  const saveNew = useCallback(async () => {
    if (!user?.id || !row || saving) return;
    if (row.roster_person_id) {
      router.replace(`/roster/${row.roster_person_id}`);
      return;
    }
    setSaving(true);
    try {
      const person = await createRosterPerson({
        owner_id: user.id,
        display_name: row.query_name,
        estimated_age: row.query_age,
        dob: row.matched_dob ?? null,
        state: row.matched_state ?? row.query_state,
        zip: row.matched_zip ?? row.query_zip,
        notes: null,
        source: 'registry_lookup',
      });
      const linked = await linkRegistryCheckToRoster(user.id, row.id, person.id);
      setRow(linked);
      router.replace(`/roster/${person.id}`);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }, [row, router, saving, user?.id]);

  const mergeInto = useCallback(
    async (personId: string) => {
      if (!user?.id || !row || saving) return;
      setSaving(true);
      setMergeOpen(false);
      try {
        await linkRegistryCheckToRoster(user.id, row.id, personId);
        router.replace(`/roster/${personId}`);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not link to roster.');
      } finally {
        setSaving(false);
      }
    },
    [row, router, saving, user?.id],
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppDock />
      </View>
    );
  }

  if (loadError && !row) {
    return (
      <View style={styles.screen}>
        <View style={[styles.inner, { paddingTop: topPad, paddingBottom: dockH }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ChevronLeft color={colors.primary} size={28} strokeWidth={2} />
          </Pressable>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
        <AppDock />
      </View>
    );
  }

  if (!row) return null;

  const alreadyLinked = row.roster_person_id != null;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: dockH + spacing.lg,
          paddingHorizontal: containerMargin,
        }}
      >
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ChevronLeft color={colors.primary} size={28} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Result</Text>
          <View style={styles.backSpacer} />
        </View>

        <View style={[styles.statusCard, ambientCard]}>
          <Text style={styles.statusLabel}>{statusLabel(row.status)}</Text>
          <Text style={styles.queryLine}>
            Query: {row.query_name}
            {queryCity ? ` · ${queryCity}` : ''}
            {row.query_state ? ` · ${row.query_state}` : ''}
            {row.query_zip ? ` · ${row.query_zip}` : ''}
          </Text>
        </View>

        {sortedMatches.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Possible registry records</Text>
            {sortedMatches.map((m, i) => (
              <View
                key={m.sourceId ?? `${m.name}-${i}`}
                style={[styles.matchCard, ambientCard, styles.matchRow]}
              >
                {m.mugshotUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open face photo for ${m.name}`}
                    onPress={() => setFacePreviewUrl(m.mugshotUrl ?? null)}
                    style={({ pressed }) => [styles.avatarPressable, pressed && styles.pressed]}
                  >
                    <Image source={{ uri: m.mugshotUrl }} style={styles.avatarImage} />
                  </Pressable>
                ) : (
                  <View
                    style={styles.avatarPlaceholder}
                    accessibilityLabel={`No photo for ${m.name}`}
                  >
                    <UserRound color={colors.slate400} size={28} strokeWidth={1.8} />
                  </View>
                )}
                <View style={styles.matchBody}>
                  <Text style={styles.matchName}>{m.name}</Text>
                  <Text style={styles.matchMeta}>
                    {[m.dob, m.state, m.zip].filter(Boolean).join(' · ') || '—'}
                  </Text>
                  {m.mugshotUrl ? (
                    <Text style={styles.faceHint}>Tap photo to enlarge</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : row.status !== 'clear' ? null : (
          <Text style={styles.clearNote}>No matching public registry entries for this query.</Text>
        )}

        <Text style={styles.disclaimer}>{disclaimer}</Text>

        {loadError ? <Text style={styles.inlineError}>{loadError}</Text> : null}

        {alreadyLinked ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(`/roster/${row.roster_person_id}`)}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>View roster profile</Text>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void saveNew()}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryLabel}>Save to roster</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void openMerge()}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>Merge into existing person</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={mergeOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Choose roster person</Text>
            <FlatList
              data={roster}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.rosterRow, pressed && styles.pressed]}
                  onPress={() => void mergeInto(item.id)}
                >
                  <View style={styles.rosterIcon}>
                    <UserRound color={colors.primary} size={22} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rosterName}>{item.display_name}</Text>
                    <Text style={styles.rosterSub}>
                      {[item.estimated_age != null ? `Age ${item.estimated_age}` : null, item.state]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyRoster}>No active roster people yet. Save as new first.</Text>
              }
            />
            <Pressable
              style={styles.modalClose}
              onPress={() => setMergeOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.modalCloseLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={facePreviewUrl != null}
        transparent
        animationType="fade"
        onRequestClose={() => setFacePreviewUrl(null)}
      >
        <Pressable
          style={styles.photoBackdrop}
          onPress={() => setFacePreviewUrl(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo preview"
        >
          {facePreviewUrl ? (
            <Image source={{ uri: facePreviewUrl }} style={styles.photoFull} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>

      <AppDock />
    </View>
  );
}

const tertiaryFieldBg = 'rgba(227, 225, 238, 0.3)';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    paddingHorizontal: containerMargin,
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
  backSpacer: { width: 44 },
  pressed: { opacity: 0.88 },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.25),
    color: colors.primary,
  },
  statusCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  statusLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  queryLine: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.onSurfaceVariant,
  },
  section: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  matchCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarPressable: {
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchBody: {
    flex: 1,
    minWidth: 0,
  },
  faceHint: {
    marginTop: 6,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.tertiary,
  },
  matchName: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.primary,
  },
  matchMeta: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  clearNote: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.lg,
  },
  disclaimer: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.tertiary,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    color: colors.onPrimary,
  },
  secondaryBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryFixed,
  },
  secondaryLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.primary,
  },
  disabled: { opacity: 0.6 },
  errorText: {
    marginTop: spacing.lg,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.bodyMd,
    color: colors.error,
  },
  inlineError: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.error,
    marginBottom: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '70%',
  },
  modalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.bodyLg,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.primaryFixed,
  },
  rosterIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: tertiaryFieldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterName: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.primary,
  },
  rosterSub: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.tertiary,
    marginTop: 2,
  },
  emptyRoster: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.tertiary,
    paddingVertical: spacing.lg,
  },
  modalClose: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  modalCloseLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.primary,
  },
  photoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  photoFull: {
    width: '100%',
    height: '80%',
    borderRadius: radii.md,
  },
});
