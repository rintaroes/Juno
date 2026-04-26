import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import {
  CalendarClock,
  Footprints,
  Heart,
  Home,
  MapPin,
  UserRound,
  X,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../components/AppDock';
import {
  endDateSession,
  getMyActiveDateSession,
  getMyLiveLocation,
  listFriendsMapSnapshots,
  startDateSession,
  updateMyLiveLocation,
  type DateSessionRow,
  type FriendMapSnapshot,
  type LiveLocationRow,
} from '../lib/dateMode';
import { listRosterPeople, type RosterPerson } from '../lib/roster';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import {
  colors,
  containerMargin,
  fontFamily,
  getDockOuterHeight,
  lineHeight,
  mapGoogleLightStyle,
  pinGlow,
  radii,
  spacing,
  typeScale,
} from '../theme';

const FALLBACK_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

const TIMER_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: 'None', minutes: null },
  { label: '60 min', minutes: 60 },
  { label: '2 hr', minutes: 120 },
  { label: '3 hr', minutes: 180 },
];

function displayName(s: FriendMapSnapshot) {
  return s.first_name?.trim() || (s.username ? `@${s.username}` : 'Friend');
}

function initialLetter(name: string) {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

function formatUpdated(iso: string | null) {
  if (!iso) return 'No location yet';
  const t = new Date(iso).getTime();
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function formatSessionClock(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function timerLine(
  startedAt: string | null,
  timerMinutes: number | null,
  nowMs: number,
): string | null {
  if (!startedAt || timerMinutes == null || timerMinutes <= 0) return null;
  const end = new Date(startedAt).getTime() + timerMinutes * 60_000;
  const ms = end - nowMs;
  if (ms <= 0) return 'Timer ended';
  const m = Math.ceil(ms / 60_000);
  return `${m} min remaining`;
}

type PinModel = {
  id: string;
  latitude: number;
  longitude: number;
  badge: string;
  badgeVariant: 'primary' | 'glass' | 'date';
  initial: string;
  markerSize: number;
};

function PinMarker({
  pin,
  onOpen,
}: {
  pin: PinModel;
  onOpen: (id: string) => void;
}) {
  const badgeStyles =
    pin.badgeVariant === 'primary'
      ? styles.badgePrimary
      : pin.badgeVariant === 'date'
        ? styles.badgeDate
        : styles.badgeGlass;
  const badgeTextStyles =
    pin.badgeVariant === 'primary'
      ? styles.badgeTextOnPrimary
      : pin.badgeVariant === 'date'
        ? styles.badgeTextDate
        : styles.badgeTextGlass;

  const BadgeIcon =
    pin.badgeVariant === 'primary'
      ? Home
      : pin.badgeVariant === 'date'
        ? Heart
        : Footprints;

  const s = pin.markerSize;

  return (
    <Marker
      coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
      onPress={() => onOpen(pin.id)}
    >
      <View style={styles.pinPress}>
        <View style={styles.pinColumn}>
          <View style={[styles.badgeRow, badgeStyles]}>
            <BadgeIcon
              size={14}
              color={
                pin.badgeVariant === 'primary'
                  ? colors.onPrimary
                  : pin.badgeVariant === 'date'
                    ? colors.onSecondaryContainer
                    : colors.primary
              }
              strokeWidth={2}
            />
            <Text style={[styles.badgeLabel, badgeTextStyles]} numberOfLines={1}>
              {pin.badge}
            </Text>
          </View>
          <View
            style={[
              styles.avatarDisc,
              { width: s, height: s, borderRadius: s / 2 },
              pinGlow,
            ]}
          >
            <Text style={[styles.avatarInitial, { fontSize: s * 0.32 }]}>{pin.initial}</Text>
          </View>
          <View style={styles.tail} />
        </View>
      </View>
    </Marker>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastServerPush = useRef(0);

  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<FriendMapSnapshot[]>([]);
  const [myCoords, setMyCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [myFirstName, setMyFirstName] = useState<string | null>(null);
  const [locPerm, setLocPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [timerChoice, setTimerChoice] = useState<number | null>(null);
  const [myLive, setMyLive] = useState<LiveLocationRow | null>(null);
  const [mySession, setMySession] = useState<DateSessionRow | null>(null);
  const [dateActionLoading, setDateActionLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const dockH = useMemo(() => getDockOuterHeight(insets.bottom), [insets.bottom]);
  const sheetBottom = dockH + spacing.sm;

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const refreshFriends = useCallback(async () => {
    if (!user?.id) return;
    const rows = await listFriendsMapSnapshots();
    setFriends(rows);
  }, [user?.id]);

  const refreshMyDateState = useCallback(async () => {
    if (!user?.id) return;
    const [live, session] = await Promise.all([
      getMyLiveLocation(user.id),
      getMyActiveDateSession(user.id),
    ]);
    setMyLive(live);
    setMySession(session);
  }, [user?.id]);

  const pushLiveToServer = useCallback(
    async (lat: number, lng: number, accuracy: number | null, force: boolean) => {
      const now = Date.now();
      if (!force && now - lastServerPush.current < 10_000) return;
      lastServerPush.current = now;
      try {
        await updateMyLiveLocation(lat, lng, accuracy);
      } catch (e) {
        console.warn('update_my_live_location', e);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setLocPerm('unknown');
        return undefined;
      }

      let alive = true;
      let poll: ReturnType<typeof setInterval> | null = null;
      const supabase = getSupabase();
      const rtChannel = supabase
        .channel(`map-live-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'live_locations' },
          () => {
            if (alive) void refreshFriends();
          },
        )
        .subscribe();

      (async () => {
        try {
          const { data: prof } = await getSupabase()
            .from('profiles')
            .select('first_name')
            .eq('id', user.id)
            .maybeSingle();
          if (alive) setMyFirstName(prof?.first_name ?? null);
        } catch {
          /* ignore */
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;
        setLocPerm(status === 'granted' ? 'granted' : 'denied');

        if (status === 'granted') {
          try {
            const cur = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (!alive) return;
            const { latitude, longitude } = cur.coords;
            const acc = cur.coords.accuracy ?? null;
            setMyCoords({ latitude, longitude });
            await pushLiveToServer(latitude, longitude, acc, true);
          } catch {
            /* simulator / denied hardware */
          }

          watchRef.current?.remove();
          watchRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 15_000,
              distanceInterval: 40,
            },
            (pos) => {
              if (!alive) return;
              const { latitude, longitude } = pos.coords;
              const acc = pos.coords.accuracy ?? null;
              setMyCoords({ latitude, longitude });
              void pushLiveToServer(latitude, longitude, acc, false);
            },
          );
        }

        try {
          await refreshFriends();
          await refreshMyDateState();
          if (alive) setMapLoadError(null);
        } catch (e) {
          if (alive) {
            setMapLoadError(e instanceof Error ? e.message : 'Could not load circle map.');
          }
        }

        poll = setInterval(() => {
          void refreshFriends().catch(() => {});
        }, 60_000);
      })();

      return () => {
        alive = false;
        void supabase.removeChannel(rtChannel);
        watchRef.current?.remove();
        watchRef.current = null;
        if (poll) clearInterval(poll);
      };
    }, [user?.id, pushLiveToServer, refreshFriends, refreshMyDateState]),
  );

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => {
      const n = displayName(f).toLowerCase();
      const u = (f.username ?? '').toLowerCase();
      return n.includes(q) || u.includes(q);
    });
  }, [friends, query]);

  const sortedSheet = useMemo(
    () =>
      [...filteredFriends].sort((a, b) => {
        const da = a.status === 'on_date' ? 0 : 1;
        const db = b.status === 'on_date' ? 0 : 1;
        return da - db || displayName(a).localeCompare(displayName(b));
      }),
    [filteredFriends],
  );

  const pins: PinModel[] = useMemo(() => {
    const out: PinModel[] = [];
    if (user?.id && myCoords) {
      const onDate = myLive?.status === 'on_date';
      out.push({
        id: `me:${user.id}`,
        latitude: myCoords.latitude,
        longitude: myCoords.longitude,
        badge: onDate ? 'On a Date' : 'You',
        badgeVariant: onDate ? 'date' : 'primary',
        initial: initialLetter(myFirstName || user.email?.split('@')[0] || 'Y'),
        markerSize: 64,
      });
    }
    for (const f of friends) {
      if (f.lat == null || f.lng == null) continue;
      const onDate = f.status === 'on_date';
      out.push({
        id: `friend:${f.profile_id}`,
        latitude: f.lat,
        longitude: f.lng,
        badge: onDate ? 'On a Date' : 'Circle',
        badgeVariant: onDate ? 'date' : 'glass',
        initial: initialLetter(displayName(f)),
        markerSize: 56,
      });
    }
    return out;
  }, [friends, myCoords, myFirstName, myLive?.status, user?.id, user?.email]);

  useEffect(() => {
    const coords = pins.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (coords.length === 0) return;
    const t = setTimeout(() => {
      if (coords.length === 1) {
        mapRef.current?.animateToRegion(
          {
            ...coords[0],
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          },
          280,
        );
      } else {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 48, bottom: 220, left: 48 },
          animated: true,
        });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [pins]);

  const selectedFriend = useMemo(() => {
    if (!selectedId?.startsWith('friend:')) return null;
    const pid = selectedId.slice('friend:'.length);
    return friends.find((f) => f.profile_id === pid) ?? null;
  }, [friends, selectedId]);

  const openDateModal = useCallback(() => {
    setDateModalOpen(true);
    if (!user?.id) return;
    setRosterLoading(true);
    void listRosterPeople(user.id, false)
      .then((rows) => setRoster(rows))
      .catch(() => setRoster([]))
      .finally(() => setRosterLoading(false));
    void refreshMyDateState();
  }, [user?.id, refreshMyDateState]);

  const onStartDate = useCallback(async () => {
    if (!user?.id || !selectedRosterId) {
      Alert.alert('Pick someone', 'Choose a person from your roster you are meeting.');
      return;
    }
    if (!myCoords) {
      Alert.alert(
        'Location needed',
        'Turn on location permission so friends can see you on the map.',
      );
      return;
    }
    setDateActionLoading(true);
    try {
      await startDateSession({
        rosterPersonId: selectedRosterId,
        timerMinutes: timerChoice,
        lat: myCoords.latitude,
        lng: myCoords.longitude,
        accuracy: null,
      });
      await refreshMyDateState();
      await refreshFriends();
      setDateModalOpen(false);
      setSelectedRosterId(null);
    } catch (e) {
      Alert.alert('Could not start', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setDateActionLoading(false);
    }
  }, [myCoords, refreshFriends, refreshMyDateState, selectedRosterId, timerChoice, user?.id]);

  const onEndDate = useCallback(async () => {
    setDateActionLoading(true);
    try {
      await endDateSession();
      await refreshMyDateState();
      await refreshFriends();
      setDateModalOpen(false);
    } catch (e) {
      Alert.alert('Could not end date', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setDateActionLoading(false);
    }
  }, [refreshFriends, refreshMyDateState]);

  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
  const mapStyle = Platform.OS === 'android' ? [...mapGoogleLightStyle] : undefined;

  const onPinOpen = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const detailFriend = selectedFriend;
  const detailSelf = selectedId?.startsWith('me:');

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={FALLBACK_REGION}
        provider={mapProvider}
        customMapStyle={mapStyle}
        mapType="standard"
        showsPointsOfInterest
        showsBuildings
        showsUserLocation={false}
        toolbarEnabled={false}
      >
        {pins.map((p) => (
          <PinMarker key={p.id} pin={p} onOpen={onPinOpen} />
        ))}
      </MapView>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {locPerm === 'denied' ? (
          <View
            style={[
              styles.banner,
              { top: insets.top + spacing.sm, marginHorizontal: containerMargin },
            ]}
          >
            <MapPin color={colors.primary} size={18} strokeWidth={2} />
            <Text style={styles.bannerText}>
              Location is off. Enable it in Settings to share your position with friends while you
              use this tab.
            </Text>
          </View>
        ) : null}

        {mapLoadError ? (
          <View
            style={[
              styles.banner,
              { top: insets.top + spacing.sm, marginHorizontal: containerMargin },
            ]}
          >
            <Text style={styles.bannerText}>{mapLoadError}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.searchWrap,
            {
              top: insets.top + (locPerm === 'denied' || mapLoadError ? 72 : spacing.sm),
              left: containerMargin,
              right: containerMargin,
            },
          ]}
        >
          <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.searchGlass} />
          <View style={styles.searchInner}>
            <UserRound color={colors.primary} size={22} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your circle…"
              placeholderTextColor={colors.outline}
              style={styles.searchInput}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Date mode"
          onPress={openDateModal}
          style={({ pressed }) => [
            styles.dateFab,
            {
              top: insets.top + (locPerm === 'denied' || mapLoadError ? 128 : 68),
              right: containerMargin,
            },
            pressed && styles.pressed,
          ]}
        >
          <Heart color={colors.onSecondaryContainer} size={20} strokeWidth={2} />
          <Text style={styles.dateFabLabel}>Date mode</Text>
        </Pressable>

        <View
          style={[
            styles.sheet,
            {
              bottom: sheetBottom,
              left: spacing.sm,
              right: spacing.sm,
            },
          ]}
        >
          <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.sheetTint} />
          <View style={styles.sheetHandle}>
            <View style={styles.sheetGrab} />
          </View>
          <Text style={styles.sheetTitle}>Circle</Text>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollInner}
            showsVerticalScrollIndicator={false}
          >
            {!user?.id ? (
              <Text style={styles.emptyText}>Sign in to see your circle on the map.</Text>
            ) : sortedSheet.length === 0 ? (
              <Text style={styles.emptyText}>
                {friends.length === 0
                  ? 'Add accepted friends in Circles to see them here. When they share location on the Map tab, pins appear.'
                  : 'No one matches your search.'}
              </Text>
            ) : (
              sortedSheet.map((person) => {
                const name = displayName(person);
                const hasPin = person.lat != null && person.lng != null;
                const sub = !hasPin
                  ? 'Has not shared location yet'
                  : person.status === 'on_date'
                    ? `With ${person.companion_display_name ?? 'someone'} · ${formatUpdated(person.updated_at)}`
                    : `Last update ${formatUpdated(person.updated_at)}`;
                return (
                  <Pressable
                    key={person.profile_id}
                    onPress={() => {
                      if (hasPin) {
                        setSelectedId(`friend:${person.profile_id}`);
                      } else {
                        Alert.alert(
                          name,
                          'They have not turned on location sharing yet. Ask them to open Map with location enabled.',
                        );
                      }
                    }}
                    style={({ pressed }) => [
                      styles.personRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.personAvatar}>
                      <Text style={styles.personInitial}>{initialLetter(name)}</Text>
                      <View style={styles.personBadge}>
                        {person.status === 'on_date' ? (
                          <Heart color={colors.secondary} size={14} strokeWidth={2} />
                        ) : (
                          <Footprints color={colors.primary} size={14} strokeWidth={2} />
                        )}
                      </View>
                    </View>
                    <View style={styles.personMain}>
                      <View style={styles.personTop}>
                        <View style={styles.personNameCell}>
                          <Text style={styles.personName} numberOfLines={1}>
                            {name}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.personSub} numberOfLines={2}>
                        {sub}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={selectedId != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedId(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedId(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {detailSelf ? 'You' : detailFriend ? displayName(detailFriend) : 'Circle'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setSelectedId(null)}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              >
                <X color={colors.onSurface} size={22} strokeWidth={2} />
              </Pressable>
            </View>
            {detailSelf ? (
              <View style={styles.modalBody}>
                <Text style={styles.modalMeta}>
                  {myLive?.status === 'on_date'
                    ? `On a date with ${mySession?.companion_display_name ?? '…'}`
                    : 'Sharing location with your circle while this tab is open.'}
                </Text>
                {mySession?.started_at ? (
                  <Text style={styles.modalHint}>
                    Started {formatSessionClock(mySession.started_at)}
                  </Text>
                ) : null}
                {mySession?.timer_minutes ? (
                  <Text style={styles.modalMeta}>
                    {timerLine(mySession.started_at, mySession.timer_minutes, Date.now())}
                  </Text>
                ) : null}
                {mySession?.companion_ai_summary ? (
                  <View style={styles.summaryBlock}>
                    <Text style={styles.summaryLabel}>Roster snapshot</Text>
                    <Text style={styles.summaryText}>{mySession.companion_ai_summary}</Text>
                  </View>
                ) : null}
              </View>
            ) : detailFriend ? (
              <View style={styles.modalBody}>
                <Text style={styles.modalMeta}>
                  {detailFriend.status === 'on_date'
                    ? `On a date with ${detailFriend.companion_display_name ?? 'someone'}`
                    : 'Available — location shared with you.'}
                </Text>
                {detailFriend.session_started_at ? (
                  <Text style={styles.modalHint}>
                    Date started {formatSessionClock(detailFriend.session_started_at)}
                  </Text>
                ) : null}
                {detailFriend.session_started_at && detailFriend.timer_minutes ? (
                  <Text style={styles.modalMeta}>
                    {timerLine(
                      detailFriend.session_started_at,
                      detailFriend.timer_minutes,
                      Date.now(),
                    )}
                  </Text>
                ) : null}
                {detailFriend.companion_ai_summary ? (
                  <View style={styles.summaryBlock}>
                    <Text style={styles.summaryLabel}>Their roster snapshot</Text>
                    <Text style={styles.summaryText}>{detailFriend.companion_ai_summary}</Text>
                  </View>
                ) : null}
                <Text style={styles.modalHint}>
                  Last location update: {formatUpdated(detailFriend.updated_at)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={dateModalOpen} animationType="slide" onRequestClose={() => setDateModalOpen(false)}>
        <View style={[styles.dateModalScreen, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.dateModalHeader}>
            <Text style={styles.dateModalTitle}>Date mode</Text>
            <Pressable onPress={() => setDateModalOpen(false)} style={({ pressed }) => [pressed && styles.pressed]}>
              <X color={colors.onSurface} size={26} strokeWidth={2} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.dateModalScroll}
            keyboardShouldPersistTaps="handled"
          >
            {mySession?.status === 'active' ? (
              <>
                <Text style={styles.sectionLabel}>Active date</Text>
                <View style={styles.activeCard}>
                  <Text style={styles.activeWith}>
                    With {mySession.companion_display_name}
                  </Text>
                  {mySession.started_at ? (
                    <Text style={styles.modalHint}>
                      Started {formatSessionClock(mySession.started_at)}
                    </Text>
                  ) : null}
                  {mySession.timer_minutes ? (
                    <View style={styles.timerLineRow}>
                      <CalendarClock size={16} color={colors.tertiary} />
                      <Text style={styles.modalMeta}>
                        {timerLine(mySession.started_at, mySession.timer_minutes, Date.now())}
                      </Text>
                    </View>
                  ) : null}
                  {mySession.companion_ai_summary ? (
                    <View style={[styles.summaryBlock, { marginTop: spacing.sm }]}>
                      <Text style={styles.summaryLabel}>Roster snapshot</Text>
                      <Text style={styles.summaryText}>{mySession.companion_ai_summary}</Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  onPress={onEndDate}
                  disabled={dateActionLoading}
                  style={({ pressed }) => [
                    styles.endBtn,
                    pressed && styles.pressed,
                    dateActionLoading && styles.disabledBtn,
                  ]}
                >
                  {dateActionLoading ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.endBtnText}>End date</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Who are you meeting?</Text>
                {rosterLoading ? (
                  <ActivityIndicator style={{ marginVertical: 24 }} />
                ) : roster.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Add someone to your roster first, then you can start date mode.
                  </Text>
                ) : (
                  roster.map((item) => {
                    const sel = selectedRosterId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setSelectedRosterId(item.id)}
                        style={[styles.rosterPick, sel && styles.rosterPickOn]}
                      >
                        <Text style={styles.rosterPickName}>{item.display_name}</Text>
                      </Pressable>
                    );
                  })
                )}
                <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Check-in timer</Text>
                <View style={styles.timerRow}>
                  {TIMER_OPTIONS.map((opt) => {
                    const on = timerChoice === opt.minutes;
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => setTimerChoice(opt.minutes)}
                        style={[styles.timerChip, on && styles.timerChipOn]}
                      >
                        <Text style={[styles.timerChipText, on && styles.timerChipTextOn]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  onPress={onStartDate}
                  disabled={dateActionLoading || !selectedRosterId}
                  style={({ pressed }) => [
                    styles.startBtn,
                    pressed && styles.pressed,
                    (!selectedRosterId || dateActionLoading) && styles.disabledBtn,
                  ]}
                >
                  {dateActionLoading ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.startBtnText}>Start date</Text>
                  )}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <AppDock />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  banner: {
    position: 'absolute',
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 248, 240, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  bannerText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.4),
    color: colors.onSurface,
  },
  searchWrap: {
    position: 'absolute',
    zIndex: 30,
    borderRadius: radii.full,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  searchGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.5),
    color: colors.onSurface,
    padding: 0,
    margin: 0,
  },
  dateFab: {
    position: 'absolute',
    zIndex: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.secondaryContainer,
    borderWidth: 1,
    borderColor: 'rgba(201, 196, 213, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  dateFabLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.onSecondaryContainer,
  },
  sheet: {
    position: 'absolute',
    zIndex: 30,
    maxHeight: 300,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 30,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  sheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  sheetHandle: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetGrab: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(201, 196, 213, 0.45)',
  },
  sheetTitle: {
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
  },
  sheetScroll: {
    maxHeight: 220,
  },
  sheetScrollInner: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.45),
    color: colors.onSurfaceVariant,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryFixed,
    borderWidth: 1,
    borderColor: 'rgba(201, 196, 213, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitial: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.primary,
  },
  personBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.full,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.surfaceContainerLowest,
  },
  personMain: {
    flex: 1,
    minWidth: 0,
  },
  personTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 8,
  },
  personNameCell: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.43),
    color: colors.onSurface,
  },
  personSub: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  pinPress: {
    alignItems: 'center',
  },
  pinColumn: {
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginBottom: 6,
    maxWidth: 200,
  },
  badgePrimary: {
    backgroundColor: colors.primary,
  },
  badgeGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  badgeDate: {
    backgroundColor: colors.secondaryContainer,
  },
  badgeLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.33),
    flexShrink: 1,
  },
  badgeTextOnPrimary: {
    color: colors.onPrimary,
  },
  badgeTextGlass: {
    color: colors.primary,
  },
  badgeTextDate: {
    color: colors.onSecondaryContainer,
  },
  avatarDisc: {
    borderWidth: 3,
    borderColor: colors.surfaceContainerLowest,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.bold,
    color: colors.primary,
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.surfaceContainerLowest,
  },
  pressed: {
    opacity: 0.86,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: containerMargin,
  },
  modalCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.lg,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.titleLg,
    color: colors.onSurface,
  },
  iconBtn: {
    padding: 4,
  },
  modalBody: {
    gap: spacing.sm,
  },
  modalMeta: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.45),
    color: colors.onSurfaceVariant,
  },
  modalHint: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.tertiary,
  },
  summaryBlock: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLow,
    maxHeight: 180,
  },
  summaryLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
    marginBottom: 6,
  },
  summaryText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.45),
    color: colors.onSurface,
  },
  dateModalScreen: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: containerMargin,
  },
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dateModalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.headlineMd,
    color: colors.onSurface,
  },
  dateModalScroll: {
    paddingBottom: spacing.xl * 2,
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  rosterPick: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceContainerLowest,
  },
  rosterPickOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  rosterPickName: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.bodyMd,
    color: colors.onSurface,
  },
  timerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(201, 196, 213, 0.5)',
    backgroundColor: colors.surfaceContainerLowest,
  },
  timerChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  timerChipText: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
  },
  timerChipTextOn: {
    color: colors.primary,
  },
  startBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  startBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onPrimary,
  },
  endBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.error,
    paddingVertical: 16,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  endBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: '#fff',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  activeCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.secondaryContainer,
    marginBottom: spacing.md,
  },
  activeWith: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.onSecondaryContainer,
  },
  timerLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
});
