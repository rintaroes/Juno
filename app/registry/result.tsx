import { ChevronLeft, UserRound } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Svg, { Circle, Path } from 'react-native-svg';
import { AppDock } from '../../components/AppDock';
import type { RegistryMatch } from '../../lib/api/registry';
import { ageFromIsoDobLocal } from '../../lib/registryAge';
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

/** Many rows include a bad/empty image URL; RN Image then shows a blank disc. */
function sanitizeHttpUrl(u?: string | null): string | null {
  const t = u?.trim();
  if (!t || t === 'null' || t === 'undefined') return null;
  if (!/^https?:\/\//i.test(t)) return null;
  return t;
}

function hasMugshot(m: RegistryMatch) {
  return sanitizeHttpUrl(m.mugshotUrl) != null;
}

function sortMatchesWithPhotosFirst(list: RegistryMatch[]) {
  return [...list].sort((a, b) => {
    const ap = hasMugshot(a);
    const bp = hasMugshot(b);
    if (ap !== bp) return ap ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Same image URL with different query params (or same person, multiple addresses). */
function mugshotDedupeKey(url: string): string {
  const t = url.trim();
  try {
    const u = new URL(t);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return t;
  }
}

/**
 * Offenders.io often returns the same person multiple times (e.g. multiple addresses).
 * `sourceId` is `personUuid` when present — one id per person. Otherwise fall back to the same
 * mugshot asset (origin+pathname) or a name+location composite without a photo.
 */
function dedupeMatches(list: RegistryMatch[]): RegistryMatch[] {
  const seenPerson = new Set<string>();
  const seenPhoto = new Set<string>();
  const seenNoPhoto = new Set<string>();
  const out: RegistryMatch[] = [];

  for (const m of list) {
    const pid = m.sourceId?.trim();
    if (pid) {
      if (seenPerson.has(pid)) continue;
      seenPerson.add(pid);
      out.push(m);
      continue;
    }
    const url = sanitizeHttpUrl(m.mugshotUrl);
    if (url) {
      const k = mugshotDedupeKey(url);
      if (seenPhoto.has(k)) continue;
      seenPhoto.add(k);
      out.push(m);
      continue;
    }
    const nk = [
      normalizeName(m.name),
      (m.dob ?? '').trim().slice(0, 10),
      (m.state ?? '').trim().toLowerCase(),
      (m.zip ?? '').trim(),
    ].join('|');
    if (seenNoPhoto.has(nk)) continue;
    seenNoPhoto.add(nk);
    out.push(m);
  }
  return out;
}

/** Default avatar when there is no photo or the image failed to load (high contrast on light UI). */
function DefaultRegistryAvatar({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" accessibilityRole="image">
      <Circle cx="28" cy="28" r="28" fill="#9ca3af" />
      <Circle cx="28" cy="21" r="9" fill="#374151" />
      <Path d="M 10 52 C 10 40 46 40 46 52 L 46 56 L 10 56 Z" fill="#374151" />
    </Svg>
  );
}

function matchAgeLabel(m: RegistryMatch): string | null {
  const fromDob = ageFromIsoDobLocal(m.dob);
  if (fromDob != null) return `Age ${fromDob}`;
  const raw = m.age?.trim();
  if (raw) {
    const n = parseInt(raw.replace(/\D/g, ''), 10);
    if (!Number.isNaN(n) && n > 0 && n < 130) return `Age ${n}`;
    return `Age ${raw}`;
  }
  return null;
}

function formatMatchMeta(m: RegistryMatch) {
  return [matchAgeLabel(m), m.state, m.zip].filter(Boolean).join(' · ') || '—';
}

function matchKey(m: RegistryMatch, index: number) {
  return m.sourceId ?? `${m.name}-${m.dob ?? ''}-${m.zip ?? ''}-${index}`;
}

const MatchMugshotOrDefault = memo(function MatchMugshotOrDefault({
  name,
  mugshotUrl,
  onOpenPreview,
}: {
  name: string;
  mugshotUrl?: string;
  onOpenPreview: (url: string) => void;
}) {
  const uri = sanitizeHttpUrl(mugshotUrl);
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <View style={styles.avatarColumn}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open face photo for ${name}`}
          onPress={() => onOpenPreview(uri)}
          style={({ pressed }) => [styles.avatarPressable, pressed && styles.pressed]}
        >
          <Image
            source={{ uri }}
            style={styles.avatarImage}
            onError={() => setFailed(true)}
          />
        </Pressable>
        <Text style={styles.faceHintUnderAvatar}>Tap to enlarge</Text>
      </View>
    );
  }

  return (
    <View style={styles.avatarColumn}>
      <View style={styles.avatarPlaceholder} accessibilityLabel={`No photo for ${name}`}>
        <DefaultRegistryAvatar size={64} />
      </View>
    </View>
  );
});

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
  const [decision, setDecision] = useState<'unset' | 'false_positive' | 'confirmed_match'>('unset');
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);

  const matches = useMemo(() => parseMatches(row), [row]);
  const sortedMatches = useMemo(
    () => sortMatchesWithPhotosFirst(dedupeMatches(matches)),
    [matches],
  );
  const selectedMatch = useMemo(() => {
    if (!selectedMatchKey) return null;
    return sortedMatches.find((m, index) => matchKey(m, index) === selectedMatchKey) ?? null;
  }, [selectedMatchKey, sortedMatches]);

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
  const queryDob = (
    row?.raw_result as { input?: { dob?: string | null } } | null | undefined
  )?.input?.dob?.trim();
  const requestedRosterPersonId = (
    row?.raw_result as { input?: { requestedRosterPersonId?: string | null } } | null | undefined
  )?.input?.requestedRosterPersonId?.trim();

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
        dob: queryDob || null,
        state: row.query_state,
        zip: row.query_zip,
        notes: null,
        source: 'registry_lookup',
      });
      const linked = await linkRegistryCheckToRoster(user.id, row.id, {
        rosterPersonId: person.id,
        selectedMatch: decision === 'confirmed_match' ? selectedMatch : null,
      });
      setRow(linked);
      router.replace(`/roster/${person.id}`);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }, [decision, queryDob, row, router, saving, selectedMatch, user?.id]);

  const mergeInto = useCallback(
    async (personId: string) => {
      if (!user?.id || !row || saving) return;
      setSaving(true);
      setMergeOpen(false);
      try {
        await linkRegistryCheckToRoster(user.id, row.id, {
          rosterPersonId: personId,
          selectedMatch: decision === 'confirmed_match' ? selectedMatch : null,
        });
        router.replace(`/roster/${personId}`);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not link to roster.');
      } finally {
        setSaving(false);
      }
    },
    [decision, row, router, saving, selectedMatch, user?.id],
  );

  const linkToRequestedRoster = useCallback(async () => {
    if (!user?.id || !row || !requestedRosterPersonId || saving) return;
    setSaving(true);
    try {
      await linkRegistryCheckToRoster(user.id, row.id, {
        rosterPersonId: requestedRosterPersonId,
        selectedMatch: decision === 'confirmed_match' ? selectedMatch : null,
      });
      router.replace(`/roster/${requestedRosterPersonId}`);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not link to roster.');
    } finally {
      setSaving(false);
    }
  }, [decision, requestedRosterPersonId, row, router, saving, selectedMatch, user?.id]);

  const onCancelDate = useCallback(() => {
    Alert.alert(
      'Cancel this date?',
      'This keeps the registry check in your private history, but does not add this person to your roster.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel date',
          style: 'destructive',
          onPress: () => {
            if (requestedRosterPersonId) router.replace(`/roster/${requestedRosterPersonId}`);
            else router.replace('/roster');
          },
        },
      ],
    );
  }, [requestedRosterPersonId, router]);

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
  const hasMatches = sortedMatches.length > 0;
  const requiresExplicitDecision = hasMatches && !alreadyLinked;
  const canProceedFalsePositive = !requiresExplicitDecision || decision === 'false_positive';
  const canProceedConfirmed =
    !requiresExplicitDecision || (decision === 'confirmed_match' && selectedMatch != null);
  const canAttachToRoster = !requiresExplicitDecision || canProceedFalsePositive || canProceedConfirmed;

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
            {sortedMatches.map((m, i) => {
              const key = matchKey(m, i);
              const isSelected = selectedMatchKey === key;
              return (
                <View
                  key={key}
                  style={[
                    styles.matchCard,
                    ambientCard,
                    styles.matchRow,
                    isSelected && styles.matchCardSelected,
                  ]}
                >
                  <MatchMugshotOrDefault
                    name={m.name}
                    mugshotUrl={m.mugshotUrl}
                    onOpenPreview={(url) => setFacePreviewUrl(url)}
                  />
                  <View style={styles.matchBody}>
                    <Text style={styles.matchName}>{m.name}</Text>
                    <Text style={styles.matchMeta}>{formatMatchMeta(m)}</Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.selectBtn,
                        isSelected && styles.selectBtnOn,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => {
                        setDecision('confirmed_match');
                        setSelectedMatchKey(key);
                      }}
                    >
                      <Text style={[styles.selectBtnLabel, isSelected && styles.selectBtnLabelOn]}>
                        {isSelected ? 'Selected as confirmed person' : 'Select this as confirmed person'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.disclaimer}>{disclaimer}</Text>
        {hasMatches ? (
          <Text style={styles.disclaimer}>
            Same or similar names are common. Confirm photo, age, and location before deciding.
          </Text>
        ) : null}
        {requiresExplicitDecision ? (
          <View style={styles.decisionWrap}>
            <Text style={styles.sectionTitle}>Before you continue</Text>
            <Pressable
              onPress={() => {
                setDecision('false_positive');
                setSelectedMatchKey(null);
              }}
              style={({ pressed }) => [
                styles.decisionBtn,
                decision === 'false_positive' && styles.decisionBtnOn,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.decisionTitle,
                  decision === 'false_positive' && styles.decisionTitleOn,
                ]}
              >
                Not him (false positive)
              </Text>
              <Text style={styles.decisionBody}>
                Continue to roster without attaching a confirmed registry person.
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDecision('confirmed_match')}
              style={({ pressed }) => [
                styles.decisionBtn,
                decision === 'confirmed_match' && styles.decisionBtnOn,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.decisionTitle,
                  decision === 'confirmed_match' && styles.decisionTitleOn,
                ]}
              >
                Confirmed hit (this is him)
              </Text>
              <Text style={styles.decisionBody}>
                Select one record above, then either cancel date or continue to roster.
              </Text>
            </Pressable>
          </View>
        ) : null}

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
            {requestedRosterPersonId ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving || !canAttachToRoster}
                onPress={() => void linkToRequestedRoster()}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.pressed,
                  (saving || !canAttachToRoster) && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.primaryLabel}>
                    {decision === 'confirmed_match'
                      ? 'Add to roster anyway (attach selected record)'
                      : 'Link to this roster person'}
                  </Text>
                )}
              </Pressable>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || !canAttachToRoster}
                  onPress={() => void saveNew()}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                    (saving || !canAttachToRoster) && styles.disabled,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.primaryLabel}>
                      {decision === 'confirmed_match'
                        ? 'Add to roster anyway (attach selected record)'
                        : 'Save person to roster'}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || !canAttachToRoster}
                  onPress={() => void openMerge()}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.pressed,
                    !canAttachToRoster && styles.disabled,
                  ]}
                >
                  <Text style={styles.secondaryLabel}>Merge into existing person</Text>
                </Pressable>
              </>
            )}
            {hasMatches ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || !canProceedConfirmed}
                  onPress={onCancelDate}
                  style={({ pressed }) => [
                    styles.cancelDateBtn,
                    pressed && styles.pressed,
                    (saving || !canProceedConfirmed) && styles.disabled,
                  ]}
                >
                  <Text style={styles.cancelDateLabel}>Cancel date (do not add to roster)</Text>
                </Pressable>
                <Text style={styles.actionHint}>
                  Skip for now: use Back. This keeps the check without adding anyone to roster.
                </Text>
              </>
            ) : null}
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
  matchCardSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarColumn: {
    width: 64,
    alignItems: 'center',
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
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1d5db',
  },
  matchBody: {
    flex: 1,
    minWidth: 0,
  },
  faceHintUnderAvatar: {
    marginTop: 4,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.tertiary,
    textAlign: 'center',
    maxWidth: 72,
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
  selectBtn: {
    marginTop: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectBtnOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFixed,
  },
  selectBtnLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
  },
  selectBtnLabelOn: {
    color: colors.primary,
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
  decisionWrap: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  decisionBtn: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.md,
    gap: 6,
  },
  decisionBtnOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFixed,
  },
  decisionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.onSurface,
  },
  decisionTitleOn: {
    color: colors.primary,
  },
  decisionBody: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.4),
    color: colors.onSurfaceVariant,
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
  cancelDateBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.errorContainer,
    backgroundColor: colors.errorContainer,
  },
  cancelDateLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.error,
  },
  actionHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.tertiary,
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
