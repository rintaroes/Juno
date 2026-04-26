import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../components/AppDock';
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
} from '../lib/circles';
import { ensureProfileForUser } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
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
} from '../theme';

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
  city: string | null;
  search_email?: string | null;
}) {
  if (profile.username) return `@${profile.username}`;
  if (profile.first_name) return profile.first_name;
  if (profile.search_email) return profile.search_email;
  return 'Unknown user';
}

export default function CirclesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CircleSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [relationships, setRelationships] = useState<CircleRelationship[]>([]);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
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

  const dockH = useMemo(() => getDockOuterHeight(insets.bottom), [insets.bottom]);

  const friends = useMemo(
    () => relationships.filter((r) => r.direction === 'friend' && r.status === 'accepted'),
    [relationships],
  );
  const incoming = useMemo(
    () => relationships.filter((r) => r.direction === 'incoming' && r.status === 'pending'),
    [relationships],
  );
  const outgoing = useMemo(
    () => relationships.filter((r) => r.direction === 'outgoing' && r.status === 'pending'),
    [relationships],
  );

  const loadAll = useCallback(async () => {
    if (!user) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      await ensureProfileForUser(user);
      const [settings, relationRows] = await Promise.all([
        getCirclePrivacySettings(user.id),
        listCircleRelationships(),
      ]);
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
      setRelationships(relationRows);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to load circles.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onRunSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setErrorMsg(null);
    try {
      const rows = await searchFriendProfiles(trimmed);
      setSearchResults(rows);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const onInvite = useCallback(
    async (profileId: string) => {
      setErrorMsg(null);
      try {
        await requestFriendship(profileId);
        await Promise.all([loadAll(), onRunSearch()]);
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : 'Could not send invite.');
      }
    },
    [loadAll, onRunSearch],
  );

  const inviteStateLabel = useCallback((result: CircleSearchResult) => {
    if (result.relationship_status === 'accepted') return 'In circle';
    if (
      result.relationship_status === 'pending' &&
      result.relationship_direction === 'outgoing'
    ) {
      return 'Invite sent';
    }
    if (
      result.relationship_status === 'pending' &&
      result.relationship_direction === 'incoming'
    ) {
      return 'Respond in requests';
    }
    return 'Invite';
  }, []);

  const onRespond = useCallback(
    async (friendshipId: string, accept: boolean) => {
      setErrorMsg(null);
      try {
        await respondToFriendRequest(friendshipId, accept);
        await loadAll();
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : 'Could not respond.');
      }
    },
    [loadAll],
  );

  const onSavePrivacy = useCallback(async () => {
    if (!user) return;
    setSavingPrivacy(true);
    setErrorMsg(null);
    try {
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
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not save privacy settings.');
    } finally {
      setSavingPrivacy(false);
    }
  }, [privacyForm, loadAll, user]);

  const onRemoveFriend = useCallback(
    async (friendshipId: string) => {
      setErrorMsg(null);
      try {
        await removeFriendship(friendshipId);
        await Promise.all([loadAll(), onRunSearch()]);
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : 'Could not remove friend.');
      }
    },
    [loadAll, onRunSearch],
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: dockH + spacing.xl,
            paddingHorizontal: containerMargin,
          },
        ]}
      >
        <Text style={styles.brand}>Juno</Text>
        <Text style={styles.title}>Circles</Text>
        <Text style={styles.subtitle}>Find friends, handle invites, and tune circle privacy.</Text>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        {loading ? <Text style={styles.hint}>Loading circle data...</Text> : null}

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Friend Search</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by username, email, phone, or name"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            onPress={onRunSearch}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.primaryBtnLabel}>{searching ? 'Searching...' : 'Search'}</Text>
          </Pressable>
          {searchResults.length === 0 ? (
            <Text style={styles.hint}>No available results yet.</Text>
          ) : (
            searchResults.map((result) => (
              <View key={result.profile_id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{identityLabel(result)}</Text>
                  <Text style={styles.rowMeta}>
                    Matched on {result.matched_on}
                    {result.city ? ` · ${result.city}` : ''}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={result.relationship_status === 'accepted'}
                  onPress={() => {
                    if (result.relationship_status === 'accepted') return;
                    void onInvite(result.profile_id);
                  }}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    result.relationship_status === 'accepted' && styles.disabledBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryBtnLabel}>{inviteStateLabel(result)}</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Incoming Requests</Text>
          {incoming.length === 0 ? (
            <Text style={styles.hint}>No incoming requests.</Text>
          ) : (
            incoming.map((item) => (
              <View key={item.friendship_id} style={styles.columnRow}>
                <Text style={styles.rowTitle}>{identityLabel(item)}</Text>
                <View style={styles.inlineActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void onRespond(item.friendship_id, true);
                    }}
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryBtnLabel}>Accept</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void onRespond(item.friendship_id, false);
                    }}
                    style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.outlineBtnLabel}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Friends</Text>
          {friends.length === 0 ? (
            <Text style={styles.hint}>No friends added yet.</Text>
          ) : (
            friends.map((item) => (
              <View key={item.friendship_id} style={styles.columnRow}>
                <Text style={styles.rowTitle}>{identityLabel(item)}</Text>
                <Text style={styles.rowMeta}>
                  {item.city ?? 'No city set'}
                  {' · '}
                  {item.search_email ?? 'No email set'}
                </Text>
                <View style={styles.inlineActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void onRemoveFriend(item.friendship_id);
                    }}
                    style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.outlineBtnLabel}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
          {outgoing.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, styles.pendingTitle]}>Pending Sent</Text>
              {outgoing.map((item) => (
                <View key={item.friendship_id} style={styles.columnRow}>
                  <Text style={styles.rowTitle}>{identityLabel(item)}</Text>
                  <Text style={styles.rowMeta}>Waiting for response</Text>
                </View>
              ))}
            </>
          ) : null}
        </View>

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Privacy Settings</Text>
          <TextInput
            value={privacyForm.firstName}
            onChangeText={(value) => {
              setPrivacyForm((prev) => ({ ...prev, firstName: value }));
            }}
            placeholder="Display name"
            placeholderTextColor={colors.outline}
            style={styles.input}
          />
          <TextInput
            value={privacyForm.username}
            onChangeText={(value) => {
              setPrivacyForm((prev) => ({ ...prev, username: value }));
            }}
            autoCapitalize="none"
            placeholder="Username (letters/numbers/underscore)"
            placeholderTextColor={colors.outline}
            style={styles.input}
          />
          <TextInput
            value={privacyForm.searchEmail}
            onChangeText={(value) => {
              setPrivacyForm((prev) => ({ ...prev, searchEmail: value }));
            }}
            autoCapitalize="none"
            placeholder="Email for friend search"
            placeholderTextColor={colors.outline}
            style={styles.input}
          />
          <TextInput
            value={privacyForm.phoneE164}
            onChangeText={(value) => {
              setPrivacyForm((prev) => ({ ...prev, phoneE164: value }));
            }}
            autoCapitalize="none"
            placeholder="Phone (E.164, e.g. +12065551212)"
            placeholderTextColor={colors.outline}
            style={styles.input}
          />

          <View style={styles.toggleList}>
            {[
              {
                key: 'allowFriendRequests',
                label: 'Allow friend requests',
                value: privacyForm.allowFriendRequests,
              },
              {
                key: 'discoverableByUsername',
                label: 'Discoverable by username',
                value: privacyForm.discoverableByUsername,
              },
              {
                key: 'discoverableByEmail',
                label: 'Discoverable by email',
                value: privacyForm.discoverableByEmail,
              },
              {
                key: 'discoverableByPhone',
                label: 'Discoverable by phone',
                value: privacyForm.discoverableByPhone,
              },
            ].map((toggle) => (
              <Pressable
                key={toggle.key}
                accessibilityRole="switch"
                accessibilityState={{ checked: toggle.value }}
                onPress={() => {
                  setPrivacyForm((prev) => ({
                    ...prev,
                    [toggle.key]: !toggle.value,
                  }));
                }}
                style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
              >
                <Text style={styles.toggleLabel}>{toggle.label}</Text>
                <View
                  style={[
                    styles.togglePill,
                    toggle.value ? styles.togglePillOn : styles.togglePillOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.togglePillText,
                      toggle.value ? styles.togglePillTextOn : styles.togglePillTextOff,
                    ]}
                  >
                    {toggle.value ? 'On' : 'Off'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void onSavePrivacy();
            }}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.primaryBtnLabel}>
              {savingPrivacy ? 'Saving...' : 'Save privacy settings'}
            </Text>
          </Pressable>
        </View>
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
  scroll: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    gap: spacing.md,
  },
  brand: {
    textAlign: 'center',
    fontFamily: fontFamily.extraBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.2),
    color: colors.indigo500,
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: typeScale.headlineMd,
    lineHeight: lineHeight(typeScale.headlineMd, 1.25),
    color: colors.onSurface,
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.43),
    color: colors.onSurfaceVariant,
    marginTop: -spacing.xs,
  },
  card: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.35),
    color: colors.onSurface,
  },
  input: {
    minHeight: 46,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.5),
    color: colors.onSurface,
  },
  primaryBtn: {
    minHeight: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryBtnLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onPrimary,
  },
  secondaryBtn: {
    minHeight: 34,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryBtnLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.onPrimaryContainer,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  outlineBtn: {
    minHeight: 34,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  outlineBtnLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.onSurface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.35),
    color: colors.onSurface,
  },
  rowMeta: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.35),
    color: colors.onSurfaceVariant,
  },
  columnRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  toggleList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  toggleRow: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
  },
  togglePill: {
    minWidth: 54,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  togglePillOn: {
    backgroundColor: colors.primary,
  },
  togglePillOff: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  togglePillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
  },
  togglePillTextOn: {
    color: colors.onPrimary,
  },
  togglePillTextOff: {
    color: colors.onSurfaceVariant,
  },
  pendingTitle: {
    marginTop: spacing.sm,
  },
  error: {
    textAlign: 'center',
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    color: colors.error,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.43),
    color: colors.onSurfaceVariant,
  },
  pressed: {
    opacity: 0.86,
  },
});
