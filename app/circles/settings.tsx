import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Search, Settings2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../../components/AppDock';
import { Button } from '../../components/ui/Button';
import { ScreenGradient } from '../../components/ui/ScreenGradient';
import {
  getCirclePrivacySettings,
  listCircleRelationships,
  removeFriendship,
  requestFriendship,
  respondToFriendRequest,
  searchFriendProfiles,
  type CircleRelationship,
  type CircleSearchResult,
  updateCirclePrivacySettings,
} from '../../lib/circles';
import { rosterAvatarColor, rosterInitials } from '../../lib/rosterPresentation';
import { ensureProfileForUser } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useOnboardingStore } from '../../stores/onboardingStore';
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

type PrivacyForm = {
  firstName: string;
  username: string;
  phoneE164: string;
  searchEmail: string;
  allowFriendRequests: boolean;
  discoverableByUsername: boolean;
  discoverableByEmail: boolean;
  discoverableByPhone: boolean;
};

function identityLabel(profile: {
  first_name: string | null;
  username: string | null;
  search_email?: string | null;
}) {
  if (profile.username) return `@${profile.username}`;
  if (profile.first_name) return profile.first_name;
  if (profile.search_email) return profile.search_email;
  return 'Unknown user';
}

function friendDisplayName(r: CircleRelationship) {
  if (r.first_name?.trim()) return r.first_name.trim();
  if (r.username) return `@${r.username}`;
  return identityLabel(r);
}

function friendSubtitle(r: CircleRelationship) {
  return r.search_email?.trim() || r.city?.trim() || '—';
}

/** Invite CTA from `search_friend_profiles` relationship columns (not inferred from friends list). */
function searchResultInviteCta(result: CircleSearchResult): {
  label: string;
  disabled: boolean;
} {
  const st = result.relationship_status;
  const dir = result.relationship_direction;
  if (st === 'accepted') return { label: 'In circle', disabled: true };
  if (st === 'pending' && dir === 'outgoing') return { label: 'Pending', disabled: true };
  if (st === 'pending' && dir === 'incoming') return { label: 'In your requests', disabled: true };
  if (st === 'declined') return { label: 'Invite', disabled: false };
  return { label: 'Invite', disabled: false };
}

export default function CirclesSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const { height: windowHeight } = useWindowDimensions();
  const dockH = useMemo(() => getDockOuterHeight(insets.bottom), [insets.bottom]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CircleSearchResult[]>([]);
  /** idle = no search yet for current query; loading; done = last run finished (may be 0 rows). */
  const [searchPhase, setSearchPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const [relationships, setRelationships] = useState<CircleRelationship[]>([]);
  const [privacyForm, setPrivacyForm] = useState<PrivacyForm>({
    firstName: '',
    username: '',
    phoneE164: '',
    searchEmail: user?.email ?? '',
    allowFriendRequests: true,
    discoverableByUsername: true,
    discoverableByEmail: true,
    discoverableByPhone: false,
  });
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const friends = useMemo(
    () => relationships.filter((r) => r.direction === 'friend' && r.status === 'accepted'),
    [relationships],
  );
  const incoming = useMemo(
    () => relationships.filter((r) => r.direction === 'incoming' && r.status === 'pending'),
    [relationships],
  );

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await ensureProfileForUser(user);
      const [settings, relationRows] = await Promise.all([
        getCirclePrivacySettings(user.id),
        listCircleRelationships(),
      ]);
      setRelationships(relationRows);
      setPrivacyForm({
        firstName: settings?.first_name ?? '',
        username: settings?.username ?? '',
        phoneE164: settings?.phone_e164 ?? '',
        searchEmail: settings?.search_email ?? user.email ?? '',
        allowFriendRequests: settings?.allow_friend_requests ?? true,
        discoverableByUsername: settings?.discoverable_by_username ?? true,
        discoverableByEmail: settings?.discoverable_by_email ?? true,
        discoverableByPhone: settings?.discoverable_by_phone ?? false,
      });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchPhase('idle');
      return;
    }
    setSearchPhase('loading');
    try {
      setErrorMsg(null);
      const rows = await searchFriendProfiles(q);
      setSearchResults(rows);
      setSearchPhase('done');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Search failed.');
      setSearchResults([]);
      setSearchPhase('idle');
    }
  }, [searchQuery]);

  const savePrivacy = useCallback(async () => {
    if (!user) return;
    try {
      setErrorMsg(null);
      await updateCirclePrivacySettings(user.id, {
        first_name: privacyForm.firstName.trim() || null,
        username: privacyForm.username.trim() || null,
        phone_e164: privacyForm.phoneE164.trim() || null,
        search_email: privacyForm.searchEmail.trim() || null,
        allow_friend_requests: privacyForm.allowFriendRequests,
        discoverable_by_username: privacyForm.discoverableByUsername,
        discoverable_by_email: privacyForm.discoverableByEmail,
        discoverable_by_phone: privacyForm.discoverableByPhone,
      });
      await loadAll();
      setPrivacyModalOpen(false);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to save privacy.');
    }
  }, [loadAll, privacyForm, user]);

  const onResetOnboarding = useCallback(async () => {
    try {
      setErrorMsg(null);
      await resetOnboarding();
      await signOut();
      router.replace('/(onboarding)/characters/welcome');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to reset onboarding.');
    }
  }, [resetOnboarding, router, signOut]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScreenGradient />
      <View style={styles.mainLayer}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + spacing.md,
              paddingHorizontal: containerMargin,
              paddingBottom: dockH + spacing.lg,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Text style={styles.title}>Circles settings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open privacy settings"
              onPress={() => {
                setPrivacyModalOpen(true);
              }}
              style={({ pressed }) => [styles.settingsFab, pressed && styles.pressed]}
            >
              <Settings2 color={colors.ink} size={22} strokeWidth={1.85} />
            </Pressable>
          </View>

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
          {loading ? <Text style={styles.hint}>Loading…</Text> : null}

          <View style={styles.segment}>
            <Pressable
              onPress={() => {
                setActiveTab('friends');
              }}
              style={({ pressed }) => [
                styles.segmentHalf,
                activeTab === 'friends' && styles.segmentHalfActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.segmentLabel, activeTab === 'friends' && styles.segmentLabelActive]}
              >
                Friends
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setActiveTab('requests');
              }}
              style={({ pressed }) => [
                styles.segmentHalf,
                activeTab === 'requests' && styles.segmentHalfActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  activeTab === 'requests' && styles.segmentLabelActive,
                ]}
              >
                Requests
              </Text>
            </Pressable>
          </View>

          {activeTab === 'friends' ? (
            <View style={styles.tabPanel}>
              <View style={styles.searchWrap}>
                <View style={[styles.searchBar, ambientCard]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Run search"
                    hitSlop={8}
                    onPress={() => {
                      void runSearch();
                    }}
                    style={({ pressed }) => [styles.searchIconBtn, pressed && styles.pressed]}
                  >
                    <Search color={colors.meta} size={20} strokeWidth={2} />
                  </Pressable>
                  <TextInput
                    value={searchQuery}
                    onChangeText={(t) => {
                      setSearchQuery(t);
                      setSearchPhase('idle');
                      setSearchResults([]);
                    }}
                    placeholder="Search username/email/number"
                    placeholderTextColor={colors.meta}
                    style={styles.searchInput}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      void runSearch();
                    }}
                  />
                </View>

                {searchPhase === 'loading' || searchPhase === 'done' ? (
                  <View style={[styles.searchDropdown, ambientCard]}>
                    {searchPhase === 'loading' ? (
                      <View style={styles.searchDropdownLoading}>
                        <ActivityIndicator color={colors.cta} />
                        <Text style={styles.searchDropdownHint}>Searching…</Text>
                      </View>
                    ) : searchResults.length === 0 ? (
                      <Text style={styles.searchDropdownEmpty}>
                        No users match that name, email, or username. Try a different search.
                      </Text>
                    ) : (
                      <ScrollView
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                        style={styles.searchDropdownList}
                        showsVerticalScrollIndicator
                      >
                        {searchResults.map((result, index) => {
                          const cta = searchResultInviteCta(result);
                          const isLast = index === searchResults.length - 1;
                          return (
                            <View
                              key={result.profile_id}
                              style={[styles.searchHitRow, isLast && styles.searchHitRowLast]}
                            >
                              <View
                                style={[
                                  styles.avatarSm,
                                  { backgroundColor: rosterAvatarColor(result.profile_id) },
                                ]}
                              >
                                <Text style={styles.avatarSmText}>
                                  {rosterInitials(
                                    result.first_name?.trim() ||
                                      result.username?.replace(/^@/, '') ||
                                      result.search_email ||
                                      '?',
                                  )}
                                </Text>
                              </View>
                              <View style={styles.searchHitMain}>
                                <Text style={styles.rowTitle}>{identityLabel(result)}</Text>
                                {result.search_email ? (
                                  <Text style={styles.rowMeta} numberOfLines={1}>
                                    {result.search_email}
                                  </Text>
                                ) : null}
                                <Text style={styles.searchHitMatched}>
                                  Matched on {result.matched_on}
                                </Text>
                              </View>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ disabled: cta.disabled }}
                                disabled={cta.disabled}
                                onPress={() => {
                                  if (cta.disabled) return;
                                  void requestFriendship(result.profile_id)
                                    .then(loadAll)
                                    .then(runSearch);
                                }}
                                style={({ pressed }) => [
                                  styles.inviteBtn,
                                  cta.disabled && styles.inviteBtnDisabled,
                                  pressed && !cta.disabled && styles.pressed,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.inviteBtnText,
                                    cta.disabled && styles.inviteBtnTextDisabled,
                                  ]}
                                >
                                  {cta.label}
                                </Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                ) : null}
              </View>

              <View style={styles.listBlock}>
                {friends.length === 0 ? (
                  <Text style={styles.hint}>No friends yet.</Text>
                ) : (
                  friends.map((r) => (
                    <View key={r.friendship_id} style={[styles.friendCard, ambientCard]}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: rosterAvatarColor(r.profile_id) },
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {rosterInitials(
                            r.first_name?.trim() ||
                              r.username?.replace(/^@/, '') ||
                              r.search_email ||
                              '?',
                          )}
                        </Text>
                      </View>
                      <View style={styles.rowMain}>
                        <Text style={styles.rowTitle}>{friendDisplayName(r)}</Text>
                        <Text style={styles.rowMeta}>{friendSubtitle(r)}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void removeFriendship(r.friendship_id).then(loadAll)}
                        style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : (
            <View style={styles.tabPanel}>
              {incoming.length === 0 ? (
                <Text style={styles.hint}>No incoming requests.</Text>
              ) : (
                incoming.map((r) => (
                  <View key={r.friendship_id} style={[styles.requestCard, ambientCard]}>
                    <View style={styles.requestTop}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: rosterAvatarColor(r.profile_id) },
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {rosterInitials(
                            r.first_name?.trim() ||
                              r.username?.replace(/^@/, '') ||
                              r.search_email ||
                              '?',
                          )}
                        </Text>
                      </View>
                      <View style={styles.rowMain}>
                        <Text style={styles.rowTitle}>{identityLabel(r)}</Text>
                        {r.search_email ? (
                          <Text style={styles.rowMeta}>{r.search_email}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.requestActionsRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          void respondToFriendRequest(r.friendship_id, true).then(loadAll)
                        }
                        style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
                      >
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          void respondToFriendRequest(r.friendship_id, false).then(loadAll)
                        }
                        style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
        <AppDock />
      </View>

      <Modal
        visible={privacyModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setPrivacyModalOpen(false);
        }}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalBackdrop} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalSheetWrap}
          >
            <View
              style={[
                styles.modalSheet,
                {
                  paddingBottom: Math.max(insets.bottom, spacing.md),
                  marginBottom: dockH,
                  maxHeight: windowHeight * 0.86,
                },
              ]}
            >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy settings</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close privacy settings"
                onPress={() => {
                  setPrivacyModalOpen(false);
                }}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              >
                <X color={colors.ink} size={24} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              <ModalField label="First name">
                <TextInput
                  value={privacyForm.firstName}
                  onChangeText={(v) => {
                    setPrivacyForm((p) => ({ ...p, firstName: v }));
                  }}
                  placeholder="ex: Alex"
                  placeholderTextColor={colors.meta}
                  style={styles.modalInput}
                />
              </ModalField>
              <ModalField label="Username">
                <TextInput
                  value={privacyForm.username}
                  onChangeText={(v) => {
                    setPrivacyForm((p) => ({ ...p, username: v }));
                  }}
                  autoCapitalize="none"
                  placeholder="ex: alex_m"
                  placeholderTextColor={colors.meta}
                  style={styles.modalInput}
                />
              </ModalField>
              <ModalField label="Email">
                <TextInput
                  value={privacyForm.searchEmail}
                  onChangeText={(v) => {
                    setPrivacyForm((p) => ({ ...p, searchEmail: v }));
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="ex: jb@mail.com"
                  placeholderTextColor={colors.meta}
                  style={styles.modalInput}
                />
              </ModalField>
              <ModalField label="Phone number">
                <TextInput
                  value={privacyForm.phoneE164}
                  onChangeText={(v) => {
                    setPrivacyForm((p) => ({ ...p, phoneE164: v }));
                  }}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  placeholder="ex: 5555 222 333"
                  placeholderTextColor={colors.meta}
                  style={styles.modalInput}
                />
              </ModalField>

              <View style={styles.devBox}>
                <Text style={styles.devTitle}>Developer</Text>
                <Text style={styles.devHint}>
                  Reset onboarding state on this device and restart the onboarding flow.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void onResetOnboarding();
                  }}
                  style={({ pressed }) => [styles.devResetBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.devResetLabel}>Reset onboarding</Text>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                label="Save privacy settings"
                onPress={() => {
                  void savePrivacy();
                }}
              />
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.modalField}>
      <Text style={styles.modalLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  mainLayer: {
    flex: 1,
    zIndex: 1,
  },
  scroll: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.displayItalic,
    fontSize: typeScale.headlineLg,
    lineHeight: lineHeight(typeScale.headlineLg, 1.12),
    color: colors.ink,
    letterSpacing: -0.35,
  },
  settingsFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...Platform.select({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  segmentHalfActive: {
    backgroundColor: colors.cta,
    borderColor: colors.cta,
  },
  segmentLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.meta,
  },
  segmentLabelActive: {
    color: colors.white,
  },
  tabPanel: {
    gap: spacing.md,
  },
  searchWrap: {
    zIndex: 20,
    marginBottom: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  searchIconBtn: {
    padding: spacing.xs,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    color: colors.ink,
  },
  searchDropdown: {
    marginTop: 6,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    maxHeight: 280,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  searchDropdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchDropdownHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.meta,
  },
  searchDropdownEmpty: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.meta,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  searchDropdownList: {
    maxHeight: 280,
  },
  searchHitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  searchHitRowLast: {
    borderBottomWidth: 0,
  },
  searchHitMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  searchHitMatched: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.meta,
    marginTop: 2,
  },
  avatarSm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.white,
    letterSpacing: 0.2,
  },
  listBlock: {
    gap: spacing.sm,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  requestCard: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  requestActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
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
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.bodyMd,
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.meta,
  },
  inviteBtn: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.paper,
  },
  inviteBtnDisabled: {
    opacity: 0.55,
    backgroundColor: colors.surfaceSecondary,
  },
  inviteBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.ink,
  },
  inviteBtnTextDisabled: {
    color: colors.meta,
  },
  removeBtn: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.alert,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  removeBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.alert,
  },
  acceptBtn: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.sage,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.riskLowBg,
  },
  acceptBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.riskLowInk,
  },
  declineBtn: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.alert,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  declineBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.alert,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    color: colors.meta,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.alert,
  },
  pressed: {
    opacity: 0.88,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 17, 24, 0.45)',
  },
  modalSheetWrap: {
    width: '100%',
  },
  modalSheet: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: containerMargin,
    paddingTop: spacing.lg,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    flex: 1,
    fontFamily: fontFamily.displayItalic,
    fontSize: typeScale.headlineMd,
    lineHeight: lineHeight(typeScale.headlineMd, 1.15),
    color: colors.ink,
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  modalScrollView: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 120,
  },
  modalScroll: {
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  modalField: {
    gap: 6,
  },
  modalLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.ink,
    letterSpacing: 0.2,
  },
  modalInput: {
    minHeight: 48,
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
  devBox: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    gap: spacing.sm,
  },
  devTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.ink,
  },
  devHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.meta,
  },
  devResetBtn: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  devResetLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.ink,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.card,
  },
});
