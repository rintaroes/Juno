import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../../components/AppDock';
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
import { ensureProfileForUser } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { ambientCard, colors, containerMargin, fontFamily, getDockOuterHeight, lineHeight, radii, spacing, typeScale } from '../../theme';

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

export default function CirclesSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const dockH = useMemo(() => getDockOuterHeight(insets.bottom), [insets.bottom]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CircleSearchResult[]>([]);
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
      return;
    }
    try {
      setErrorMsg(null);
      const rows = await searchFriendProfiles(q);
      setSearchResults(rows);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Search failed.');
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
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: containerMargin,
            paddingBottom: dockH + spacing.lg,
          },
        ]}
      >
        <View style={styles.topRow}>
          <Text style={styles.title}>Circles Settings</Text>
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        {loading ? <Text style={styles.hint}>Loading...</Text> : null}

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Find Friends</Text>
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search username/email/phone/name" placeholderTextColor={colors.outline} style={styles.input} />
          <Pressable accessibilityRole="button" onPress={() => void runSearch()} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText}>Search</Text>
          </Pressable>
          {searchResults.map((result) => (
            <View key={result.profile_id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{identityLabel(result)}</Text>
                <Text style={styles.rowMeta}>Matched on {result.matched_on}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void requestFriendship(result.profile_id).then(loadAll).then(runSearch)}
                style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
              >
                <Text style={styles.outlineBtnText}>
                  {result.relationship_status === 'accepted'
                    ? 'In circle'
                    : result.relationship_status === 'pending'
                      ? 'Pending'
                      : 'Invite'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Incoming Requests</Text>
          {incoming.length === 0 ? <Text style={styles.hint}>No incoming requests.</Text> : null}
          {incoming.map((r) => (
            <View key={r.friendship_id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{identityLabel(r)}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => void respondToFriendRequest(r.friendship_id, true).then(loadAll)} style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
                <Text style={styles.outlineBtnText}>Accept</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void respondToFriendRequest(r.friendship_id, false).then(loadAll)} style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
                <Text style={styles.outlineBtnText}>Decline</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Friends</Text>
          {friends.length === 0 ? <Text style={styles.hint}>No friends yet.</Text> : null}
          {friends.map((r) => (
            <View key={r.friendship_id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{identityLabel(r)}</Text>
                <Text style={styles.rowMeta}>{r.city ?? 'No city'} · {r.search_email ?? 'No email'}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => void removeFriendship(r.friendship_id).then(loadAll)} style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
                <Text style={styles.outlineBtnText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <TextInput value={privacyForm.firstName} onChangeText={(v) => setPrivacyForm((p) => ({ ...p, firstName: v }))} placeholder="Display name" placeholderTextColor={colors.outline} style={styles.input} />
          <TextInput value={privacyForm.username} onChangeText={(v) => setPrivacyForm((p) => ({ ...p, username: v }))} autoCapitalize="none" placeholder="Username" placeholderTextColor={colors.outline} style={styles.input} />
          <TextInput value={privacyForm.searchEmail} onChangeText={(v) => setPrivacyForm((p) => ({ ...p, searchEmail: v }))} autoCapitalize="none" placeholder="Search email" placeholderTextColor={colors.outline} style={styles.input} />
          <TextInput value={privacyForm.phoneE164} onChangeText={(v) => setPrivacyForm((p) => ({ ...p, phoneE164: v }))} autoCapitalize="none" placeholder="Phone E.164" placeholderTextColor={colors.outline} style={styles.input} />
          <Pressable accessibilityRole="button" onPress={() => void savePrivacy()} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText}>Save privacy settings</Text>
          </Pressable>
        </View>

        <View style={[styles.card, ambientCard]}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <Text style={styles.hint}>
            Reset onboarding state on this device and restart the onboarding flow.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void onResetOnboarding();
            }}
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
          >
            <Text style={styles.outlineBtnText}>Reset onboarding</Text>
          </Pressable>
        </View>
      </ScrollView>
      <AppDock />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  scroll: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: typeScale.headlineMd, lineHeight: lineHeight(typeScale.headlineMd, 1.25), color: colors.onSurface },
  card: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.surfaceContainerHighest, backgroundColor: colors.surfaceContainerLowest, padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontFamily: fontFamily.semiBold, fontSize: typeScale.titleLg, color: colors.onSurface },
  input: { minHeight: 44, borderRadius: radii.input, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, fontFamily: fontFamily.regular, fontSize: typeScale.bodyMd, color: colors.onSurface },
  primaryBtn: { minHeight: 42, borderRadius: radii.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: fontFamily.semiBold, fontSize: typeScale.labelMd, color: colors.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surfaceContainerHighest, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fontFamily.semiBold, fontSize: typeScale.bodyMd, color: colors.onSurface },
  rowMeta: { fontFamily: fontFamily.regular, fontSize: typeScale.labelSm, color: colors.onSurfaceVariant },
  outlineBtn: { minHeight: 34, borderRadius: radii.full, borderWidth: 1, borderColor: colors.outlineVariant, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerLowest },
  outlineBtnText: { fontFamily: fontFamily.medium, fontSize: typeScale.labelSm, color: colors.onSurface },
  hint: { fontFamily: fontFamily.regular, fontSize: typeScale.labelMd, color: colors.onSurfaceVariant },
  error: { fontFamily: fontFamily.medium, fontSize: typeScale.labelMd, color: colors.error },
  pressed: { opacity: 0.86 },
});
