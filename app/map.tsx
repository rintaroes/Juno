import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  Clock,
  Coffee,
  Footprints,
  Heart,
  Home,
  MapPin,
  Moon,
  ShieldCheck,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  BackHandler,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  type PanResponderGestureState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import type { MapPressEvent } from 'react-native-maps/lib/MapView.types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../components/AppDock';
import { Button } from '../components/ui/Button';
import { ScreenGradient } from '../components/ui/ScreenGradient';
import {
  endDateSession,
  getMyActiveDateSession,
  getMyLiveLocation,
  listFriendsMapSnapshots,
  notifyCircleDateModeStarted,
  sendDateSafetySignal,
  startDateSession,
  updateMyLiveLocation,
  type DateSafetyKind,
  type DateSessionRow,
  type FriendMapSnapshot,
  type LiveLocationRow,
} from '../lib/dateMode';
import {
  startLiveLocationBackgroundTask,
  stopLiveLocationBackgroundTask,
} from '../lib/liveLocationBackground';
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

/** Until GPS: street-level grid only (no continent view). Smaller delta = finer tile grid / more “squares”. */
const INITIAL_MAP_LAT_DELTA = 0.0095;
const INITIAL_MAP_LNG_DELTA = 0.0095;

const FALLBACK_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: INITIAL_MAP_LAT_DELTA,
  longitudeDelta: INITIAL_MAP_LNG_DELTA,
};

/** Self: Find My–style — centered, block-scale at mid-latitudes (slightly zoomed out vs before). */
const SELF_SNAP_LAT_DELTA = 0.0102;
const SELF_SNAP_LNG_DELTA = 0.0102;
/** Friend: wider so context around them stays visible */
const FRIEND_FOCUS_LAT_DELTA = 0.062;
const FRIEND_FOCUS_LNG_DELTA = 0.062;
/** Friend pin: animated camera duration (ms) */
const FRIEND_PIN_FOCUS_MS = 720;
/** Self pin / map tap / tab focus: snap to you (near-instant) */
const SELF_PIN_FOCUS_MS = 1;
/** Max expanded height; actual height shrinks with few circle members so the sheet does not leave a tall empty band above the dock. */
const CIRCLE_SHEET_MAX_HEIGHT = 240;
/** Keep a visible lip at dock top so users can always drag/toggle back up. */
const CIRCLE_SHEET_PEEK_HEIGHT = 26;
/** Handle + “Circle” title (approx., matches padding + typography). */
const CIRCLE_SHEET_HEADER_EST = 54;
/** Floor so the sheet never looks like a sliver when expanded. */
const CIRCLE_SHEET_MIN_EXPANDED = 118;
const CIRCLE_SHEET_ROW_EST = 86;
const CIRCLE_SHEET_ROW_GAP = 8;
const CIRCLE_SHEET_BODY_PAD = 6;
/** Max sheet height as fraction of screen when a profile is open (room for drag + peek). */
const CIRCLE_SHEET_DETAIL_MAX_SCREEN = 0.62;
/**
 * Profile sheet uses a fixed pixel height (content scrolls inside). Dynamic height from layout
 * measurements was fighting translateY + map relayout and caused visible stutter.
 */
/** Short enough for address + last-update rows; tall content scrolls inside (no flex-end gap tradeoff). */
const CIRCLE_SHEET_PROFILE_SHELL_MIN = 216;

function circleProfileSheetHeightPx(): number {
  const cap = Math.floor(Dimensions.get('window').height * CIRCLE_SHEET_DETAIL_MAX_SCREEN);
  return Math.min(cap, Math.max(CIRCLE_SHEET_MIN_EXPANDED, CIRCLE_SHEET_PROFILE_SHELL_MIN));
}

/** Stable key for reverse-geocode cache (Find My–style warm addresses for pins). */
function geocodeCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function estimateCircleSheetHeight(signedIn: boolean, friendCount: number): number {
  const header = CIRCLE_SHEET_HEADER_EST;
  if (!signedIn) {
    const body = 76;
    return Math.min(
      CIRCLE_SHEET_MAX_HEIGHT,
      Math.max(CIRCLE_SHEET_MIN_EXPANDED, header + body),
    );
  }
  if (friendCount === 0) {
    const body = 112;
    return Math.min(
      CIRCLE_SHEET_MAX_HEIGHT,
      Math.max(CIRCLE_SHEET_MIN_EXPANDED, header + body),
    );
  }
  const body =
    friendCount * CIRCLE_SHEET_ROW_EST +
    Math.max(0, friendCount - 1) * CIRCLE_SHEET_ROW_GAP +
    CIRCLE_SHEET_BODY_PAD;
  return Math.min(
    CIRCLE_SHEET_MAX_HEIGHT,
    Math.max(CIRCLE_SHEET_MIN_EXPANDED, header + body),
  );
}
/** px/ms — flick down snaps to peek like the circle list sheet. */
const SHEET_VELOCITY_SNAP = 0.32;
/** Upward flick snaps fully open (lower bar than collapse; swipe-up should “go all the way”). */
const SHEET_VELOCITY_SNAP_EXPAND = 0.14;
/** Net finger movement up (px) from gesture start → snap fully expanded. */
const SHEET_SWIPE_UP_DRAG_COMMIT_PX = 28;
/** How close to the peek position counts as “close enough” to snap down. */
const SHEET_BOTTOM_SNAP_DISTANCE = 72;
/** Past this fraction of the collapse travel, release snaps to peek (same feel as circle). */
const SHEET_SNAP_PROGRESS_COLLAPSE = 0.38;
/** Near fully expanded — snap open (fraction of collapsed offset from 0). */
const SHEET_SNAP_PROGRESS_EXPAND = 0.26;
/** On-map initials disc — same diameter for you and every friend */
const MAP_PIN_MARKER_SIZE = 56;
/** Selected friend far away: clear emphasis. */
const MAP_PIN_FRIEND_SELECTED_FAR = 74;
/** Selected friend ~next to you: subtle emphasis only. */
const MAP_PIN_FRIEND_SELECTED_NEAR = 62;
/** Within this distance (m) we skip flying the camera to a friend. */
const FRIEND_CAMERA_SKIP_MAX_METERS = 200;

function formatGeocodedAddress(a: Location.LocationGeocodedAddress): string {
  const street = [a.streetNumber, a.street].filter(Boolean).join(' ').trim();
  const cityLine = [a.city || a.district || a.subregion, a.region, a.postalCode, a.country]
    .filter(Boolean)
    .join(', ');
  if (street && cityLine) return `${street}\n${cityLine}`;
  if (street) return street;
  if (cityLine) return cityLine;
  if (a.name) return a.name;
  return '';
}

/** True when the string is only “lat, lng” (geocode fallback) — hide from UI. */
function isLatCommaLngOnly(s: string): boolean {
  const line = s.trim().split('\n')[0].trim();
  return /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(line);
}

/** Split geocoded “street\ncity, …” into primary + secondary lines for hierarchy. */
function splitAddressForDisplay(raw: string): { primary: string; secondary: string | null } {
  const t = raw.trim();
  if (!t) return { primary: '', secondary: null };
  const nl = t.indexOf('\n');
  if (nl === -1) return { primary: t, secondary: null };
  const primary = t.slice(0, nl).trim();
  const secondary = t.slice(nl + 1).trim() || null;
  return { primary, secondary };
}

/** Snap target (0 = expanded, collapsedOffset = peek) — shared by handle, title strip, and profile scroll pull. */
function resolveSheetSnapTarget(
  collapsedOffset: number,
  offsetAtGestureStart: number,
  gestureState: PanResponderGestureState,
): number {
  if (collapsedOffset <= 0) return 0;
  const clamped = Math.max(0, Math.min(collapsedOffset, offsetAtGestureStart + gestureState.dy));
  const fastDown = gestureState.vy >= SHEET_VELOCITY_SNAP;
  const fastUp = gestureState.vy <= -SHEET_VELOCITY_SNAP;
  const distanceToBottom = collapsedOffset - clamped;
  const nearBottom = distanceToBottom <= SHEET_BOTTOM_SNAP_DISTANCE;
  const pastCollapseBias = clamped >= collapsedOffset * SHEET_SNAP_PROGRESS_COLLAPSE;
  const nearFullExpand = clamped <= collapsedOffset * SHEET_SNAP_PROGRESS_EXPAND;

  /** Upward intent: must win before nearBottom/pastCollapseBias (those treat “still near peek” as snap down). */
  const swipeExpand =
    gestureState.dy <= -SHEET_SWIPE_UP_DRAG_COMMIT_PX ||
    gestureState.vy <= -SHEET_VELOCITY_SNAP_EXPAND ||
    fastUp ||
    nearFullExpand;

  if (swipeExpand) {
    return 0;
  }
  if (fastDown || nearBottom || pastCollapseBias) {
    return collapsedOffset;
  }
  return clamped >= collapsedOffset * 0.5 ? collapsedOffset : 0;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function regionForFriendFocus(latitude: number, longitude: number): Region {
  return {
    latitude,
    longitude,
    latitudeDelta: FRIEND_FOCUS_LAT_DELTA,
    longitudeDelta: FRIEND_FOCUS_LNG_DELTA,
  };
}

const DATE_DURATION_OPTIONS: { id: string; label: string; subtitle: string; minutes: number }[] = [
  { id: '1h', label: '1 hour', subtitle: 'Quick coffee, quick vibe check.', minutes: 60 },
  { id: '2h', label: '2 hours', subtitle: 'Dinner and a good convo.', minutes: 120 },
  { id: '12h', label: 'Whole night', subtitle: 'A full evening out.', minutes: 720 },
];

const DURATION_OPTION_ICONS: Record<string, LucideIcon> = {
  '1h': Coffee,
  '2h': UtensilsCrossed,
  '12h': Moon,
};

const COMPANION_AVATAR_PALETTE = [
  '#C4A574',
  '#C17F59',
  '#6B7B8C',
  '#9B7B9C',
  '#5C8F7A',
  '#C97B84',
  '#8B7355',
  '#7A6B8E',
] as const;

function companionInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  const t = displayName.trim();
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return t ? `${t.charAt(0)}?`.toUpperCase() : '??';
}

function companionAvatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return COMPANION_AVATAR_PALETTE[Math.abs(h) % COMPANION_AVATAR_PALETTE.length];
}

function DatePlanProgressBar({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  return (
    <View style={styles.datePlanProgressRow}>
      {([1, 2, 3] as const).map((s) => (
        <View
          key={s}
          style={[styles.datePlanProgressSeg, s === activeStep && styles.datePlanProgressSegActive]}
        />
      ))}
    </View>
  );
}

const CUSTOM_HOUR_MAX = 23;
const CUSTOM_MINUTE_MAX = 59;
const WHEEL_ROW_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 5;
/** Closer to 1 = longer glide / more “slippery” wheel (iOS + Android). */
const WHEEL_DECELERATION_RATE = 0.9992;

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
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} remaining`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')} remaining`;
}

/** Strip trailing " remaining" from {@link timerLine} for compact UI (e.g. date mode card). */
function countdownDigits(line: string | null): string {
  if (line == null) return '—';
  return line.replace(/\s*remaining\s*$/i, '');
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
  onOpen: (pin: PinModel) => void;
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
      onPress={() => onOpen(pin)}
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
  const myCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const hoursListRef = useRef<FlatList<number> | null>(null);
  const minutesListRef = useRef<FlatList<number> | null>(null);

  const [friends, setFriends] = useState<FriendMapSnapshot[]>([]);
  const [myCoords, setMyCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [myFirstName, setMyFirstName] = useState<string | null>(null);
  const [locPerm, setLocPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetPinLocationLine, setSheetPinLocationLine] = useState<string | null>(null);
  const [sheetPinLocationLoading, setSheetPinLocationLoading] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [dateSetupStep, setDateSetupStep] = useState<1 | 2 | 3>(1);
  const [durationChoiceId, setDurationChoiceId] = useState<string | null>(null);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customHours, setCustomHours] = useState(2);
  const [customMinutes, setCustomMinutes] = useState(0);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [timerChoice, setTimerChoice] = useState<number>(120);
  const [myLive, setMyLive] = useState<LiveLocationRow | null>(null);
  const [mySession, setMySession] = useState<DateSessionRow | null>(null);
  const [dateActionLoading, setDateActionLoading] = useState(false);
  const [safetySignalLoading, setSafetySignalLoading] = useState(false);
  const [shareLocationAlways, setShareLocationAlways] = useState(false);
  const [shareLocationToggling, setShareLocationToggling] = useState(false);
  const [tick, setTick] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  /** Mirrors sheet translate so MapView mapPadding can update (ref alone does not re-render). */
  const [sheetVisualOffset, setSheetVisualOffset] = useState(0);
  /** Reverse-geocode lines by coordinate key — warmed when circle data loads (instant sheet like Find My). */
  const geocodeCacheRef = useRef<Map<string, string>>(new Map());
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetOffsetRef = useRef(0);
  /** Profile scroll offset — used so pull-down at top can drag the sheet (like the handle). */
  const detailScrollYRef = useRef(0);

  const dockH = useMemo(() => getDockOuterHeight(insets.bottom), [insets.bottom]);
  /** Treat dock top as hard bottom boundary for dragging/snap. */
  const sheetBottom = dockH - 2;

  const circleSheetHeight = useMemo(
    () => estimateCircleSheetHeight(!!user?.id, friends.length),
    [user?.id, friends.length],
  );
  const circleSheetHeightLive = useMemo(() => {
    const base = circleSheetHeight;
    if (selectedId == null) return base;
    return circleProfileSheetHeightPx();
  }, [circleSheetHeight, selectedId]);
  const collapsedSheetOffset = circleSheetHeightLive - CIRCLE_SHEET_PEEK_HEIGHT;
  /** Pixels from the bottom of the screen to the top of the circle sheet (dock + sheet − collapse). */
  const mapBottomPaddingPx = useMemo(
    () => Math.max(0, Math.round(sheetBottom + circleSheetHeightLive - sheetVisualOffset)),
    [sheetBottom, circleSheetHeightLive, sheetVisualOffset],
  );
  const mapEdgePadding = useMemo(
    () => ({
      top: 0,
      right: 0,
      bottom: mapBottomPaddingPx,
      left: 0,
    }),
    [mapBottomPaddingPx],
  );

  /** Native mapPadding centers the region in the unobscured rect; keep geographic center on the user. */
  const computeSelfSnapRegion = useCallback(
    (latitude: number, longitude: number): Region => ({
      latitude,
      longitude,
      latitudeDelta: SELF_SNAP_LAT_DELTA,
      longitudeDelta: SELF_SNAP_LNG_DELTA,
    }),
    [],
  );

  /** Programmatic snap: translateY only; sheet height is fixed in profile so layout doesn’t fight the animation. */
  const animateSheetTo = useCallback(
    (toValue: number) => {
      const max = collapsedSheetOffset;
      const target = Math.max(0, Math.min(max, toValue));
      setSheetExpanded(target <= 16);

      sheetTranslateY.stopAnimation((currentValue) => {
        const start = Math.max(0, Math.min(max, Math.round(currentValue)));
        sheetOffsetRef.current = start;

        Animated.timing(sheetTranslateY, {
          toValue: target,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            sheetOffsetRef.current = target;
            setSheetVisualOffset(target);
          }
        });
      });
    },
    [sheetTranslateY, collapsedSheetOffset],
  );

  /** After opening/changing profile, expand from peek once (does not depend on collapsed remeasure). */
  useEffect(() => {
    if (selectedId == null) return;
    detailScrollYRef.current = 0;
    const frame = requestAnimationFrame(() => {
      sheetTranslateY.stopAnimation((v) => {
        if (Math.round(v) > 12) {
          animateSheetTo(0);
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, animateSheetTo, sheetTranslateY]);

  /** Warm reverse-geocode for every pin so opening a profile can show the address immediately. */
  useEffect(() => {
    const warm = (lat: number, lng: number) => {
      const k = geocodeCacheKey(lat, lng);
      if (geocodeCacheRef.current.has(k)) return;
      void (async () => {
        try {
          const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          const a = rows[0];
          const formatted = a ? formatGeocodedAddress(a).trim() : '';
          geocodeCacheRef.current.set(k, formatted);
        } catch {
          geocodeCacheRef.current.set(k, '');
        }
      })();
    };
    if (myCoords) {
      warm(myCoords.latitude, myCoords.longitude);
    }
    for (const f of friends) {
      if (f.lat != null && f.lng != null) {
        warm(f.lat, f.lng);
      }
    }
  }, [friends, myCoords]);

  /** Grab handle: claim immediately so vertical drags always move the sheet. */
  const sheetHandleDragPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dy) > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((value) => {
            sheetOffsetRef.current = value;
            setSheetVisualOffset(value);
          });
        },
        onPanResponderMove: (_evt, gestureState) => {
          const next = Math.max(
            0,
            Math.min(collapsedSheetOffset, sheetOffsetRef.current + gestureState.dy),
          );
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const target = resolveSheetSnapTarget(
            collapsedSheetOffset,
            sheetOffsetRef.current,
            gestureState,
          );
          animateSheetTo(target);
        },
      }),
    [animateSheetTo, collapsedSheetOffset, sheetTranslateY],
  );

  /**
   * Profile title strip: only after a vertical move threshold so the back chevron still receives taps.
   * Same drag/snap math as the handle.
   */
  const sheetDetailTitleDragPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((value) => {
            sheetOffsetRef.current = value;
            setSheetVisualOffset(value);
          });
        },
        onPanResponderMove: (_evt, gestureState) => {
          const next = Math.max(
            0,
            Math.min(collapsedSheetOffset, sheetOffsetRef.current + gestureState.dy),
          );
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const target = resolveSheetSnapTarget(
            collapsedSheetOffset,
            sheetOffsetRef.current,
            gestureState,
          );
          animateSheetTo(target);
        },
      }),
    [animateSheetTo, collapsedSheetOffset, sheetTranslateY],
  );

  /**
   * When the profile scroll is at the top, capture vertical drags so the sheet moves (same as handle /
   * circle sheet): pull down to peek, pull up to expand. `dy <= 8` would reject all upward motion — use
   * `Math.abs(dy)` like `sheetDetailTitleDragPan`.
   */
  const detailProfileScrollPullPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
          if (Math.abs(gestureState.dy) <= 8) return false;
          if (Math.abs(gestureState.dy) <= Math.abs(gestureState.dx) * 1.05) return false;
          // Collapsed: ScrollView is off (same as circle) — always drag the sheet; ignore stale scroll Y.
          if (!sheetExpanded) return true;
          return detailScrollYRef.current <= 2;
        },
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((value) => {
            sheetOffsetRef.current = value;
            setSheetVisualOffset(value);
          });
        },
        onPanResponderMove: (_evt, gestureState) => {
          const next = Math.max(
            0,
            Math.min(collapsedSheetOffset, sheetOffsetRef.current + gestureState.dy),
          );
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const target = resolveSheetSnapTarget(
            collapsedSheetOffset,
            sheetOffsetRef.current,
            gestureState,
          );
          animateSheetTo(target);
        },
      }),
    [animateSheetTo, collapsedSheetOffset, sheetExpanded, sheetTranslateY],
  );

  useEffect(() => {
    myCoordsRef.current = myCoords;
  }, [myCoords]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!customPickerOpen) return;
    const t = setTimeout(() => {
      hoursListRef.current?.scrollToOffset({
        offset: customHours * WHEEL_ROW_HEIGHT,
        animated: false,
      });
      minutesListRef.current?.scrollToOffset({
        offset: customMinutes * WHEEL_ROW_HEIGHT,
        animated: false,
      });
    }, 0);
    return () => clearTimeout(t);
  }, [customHours, customMinutes, customPickerOpen]);

  /** Start/stop OS background updates when preference + permissions allow (e.g. after app restart). */
  useEffect(() => {
    if (!user?.id || Platform.OS === 'web') return;
    if (!shareLocationAlways) {
      void stopLiveLocationBackgroundTask();
      return;
    }
    void (async () => {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      if (!fg.granted || !bg.granted) return;
      await startLiveLocationBackgroundTask().catch(() => {});
    })();
  }, [user?.id, shareLocationAlways]);

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

  /** MapView sometimes ignores the first camera command until laid out; double-call fixes cold open. */
  const scheduleSnapCameraToUser = useCallback(
    (latitude: number, longitude: number) => {
      const region = computeSelfSnapRegion(latitude, longitude);
      const run = () => {
        mapRef.current?.animateToRegion(region, SELF_PIN_FOCUS_MS);
      };
      requestAnimationFrame(() => {
        run();
        setTimeout(run, 160);
      });
    },
    [computeSelfSnapRegion],
  );

  /**
   * Re-center only when the circle sheet *intrinsic height* changes (friends count / sign-in),
   * so a taller sheet still frames “you” correctly. Dragging or expanding the sheet does not run this.
   */
  useEffect(() => {
    const c = myCoordsRef.current;
    if (!c) return;
    scheduleSnapCameraToUser(c.latitude, c.longitude);
  }, [circleSheetHeight, scheduleSnapCameraToUser]);

  const onToggleShareLocationAlways = useCallback(
    async (enabled: boolean) => {
      if (!user?.id || Platform.OS === 'web') return;
      setShareLocationToggling(true);
      try {
        if (!enabled) {
          await stopLiveLocationBackgroundTask();
          const { error } = await getSupabase()
            .from('profiles')
            .update({ share_location_always: false })
            .eq('id', user.id);
          if (error) throw error;
          setShareLocationAlways(false);
          return;
        }

        let fg = await Location.getForegroundPermissionsAsync();
        if (!fg.granted) {
          fg = await Location.requestForegroundPermissionsAsync();
        }
        if (!fg.granted) {
          Alert.alert('Location needed', 'Allow location access first so your circle can see you.');
          return;
        }

        if (Platform.OS === 'android') {
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Background location',
              'Next, Android may ask you to allow location all the time so Juno can update your circle when the app is closed.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Continue', onPress: () => resolve(true) },
              ],
            );
          });
          if (!proceed) return;
        }

        let bg = await Location.getBackgroundPermissionsAsync();
        if (!bg.granted) {
          bg = await Location.requestBackgroundPermissionsAsync();
        }
        if (!bg.granted) {
          Alert.alert(
            'Always location',
            'Allow “Always” / “Allow all the time” for Juno in system settings so background sharing works.',
          );
          return;
        }

        const { error } = await getSupabase()
          .from('profiles')
          .update({ share_location_always: true })
          .eq('id', user.id);
        if (error) throw error;
        setShareLocationAlways(true);
        await startLiveLocationBackgroundTask();
      } catch (e) {
        Alert.alert(
          'Could not update',
          e instanceof Error ? e.message : 'Something went wrong.',
        );
      } finally {
        setShareLocationToggling(false);
      }
    },
    [user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setLocPerm('unknown');
        setShareLocationAlways(false);
        return undefined;
      }

      let alive = true;
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

      const poll = setInterval(() => {
        void refreshFriends().catch(() => {});
      }, 60_000);

      void (async () => {
        try {
          await Promise.all([
            refreshFriends(),
            refreshMyDateState(),
            (async () => {
              try {
                const { data: prof } = await supabase
                  .from('profiles')
                  .select('first_name, share_location_always')
                  .eq('id', user.id)
                  .maybeSingle();
                if (alive) {
                  setMyFirstName(prof?.first_name ?? null);
                  setShareLocationAlways(!!prof?.share_location_always);
                }
              } catch {
                /* ignore */
              }
            })(),
          ]);
          if (alive) setMapLoadError(null);
        } catch (e) {
          if (alive) {
            setMapLoadError(e instanceof Error ? e.message : 'Could not load circle map.');
          }
        }
      })();

      void (async () => {
        let fg = await Location.getForegroundPermissionsAsync();
        if (!alive) return;
        if (!fg.granted && fg.canAskAgain !== false) {
          fg = await Location.requestForegroundPermissionsAsync();
        }
        if (!alive) return;
        setLocPerm(fg.granted ? 'granted' : 'denied');

        if (!fg.granted) return;

        const watchOpts: Location.LocationOptions = {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15_000,
          distanceInterval: 40,
        };

        const startWatch = async () => {
          watchRef.current?.remove();
          watchRef.current = await Location.watchPositionAsync(watchOpts, (pos) => {
            if (!alive) return;
            const { latitude, longitude } = pos.coords;
            const acc = pos.coords.accuracy ?? null;
            setMyCoords({ latitude, longitude });
            void pushLiveToServer(latitude, longitude, acc, false);
          });
        };

        const cached = myCoordsRef.current;
        if (cached) {
          setMyCoords(cached);
          await startWatch();
          if (alive) scheduleSnapCameraToUser(cached.latitude, cached.longitude);
          void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })
            .then((cur) => {
              if (!alive) return;
              const { latitude, longitude } = cur.coords;
              const acc = cur.coords.accuracy ?? null;
              setMyCoords({ latitude, longitude });
              void pushLiveToServer(latitude, longitude, acc, true);
            })
            .catch(() => {
              /* hardware / simulator */
            });
          return;
        }

        let acquired: { latitude: number; longitude: number } | null = null;
        try {
          const cur = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!alive) return;
          const { latitude, longitude } = cur.coords;
          const acc = cur.coords.accuracy ?? null;
          acquired = { latitude, longitude };
          setMyCoords({ latitude, longitude });
          await pushLiveToServer(latitude, longitude, acc, true);
        } catch {
          /* simulator / denied hardware */
        }

        await startWatch();
        if (alive && acquired) {
          scheduleSnapCameraToUser(acquired.latitude, acquired.longitude);
        }
      })();

      return () => {
        alive = false;
        void supabase.removeChannel(rtChannel);
        watchRef.current?.remove();
        watchRef.current = null;
        clearInterval(poll);
      };
    }, [
      user?.id,
      pushLiveToServer,
      refreshFriends,
      refreshMyDateState,
      scheduleSnapCameraToUser,
    ]),
  );

  const sortedSheet = useMemo(
    () =>
      [...friends].sort((a, b) => {
        const da = a.status === 'on_date' ? 0 : 1;
        const db = b.status === 'on_date' ? 0 : 1;
        return da - db || displayName(a).localeCompare(displayName(b));
      }),
    [friends],
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
        markerSize: MAP_PIN_MARKER_SIZE,
      });
    }
    for (const f of friends) {
      if (f.lat == null || f.lng == null) continue;
      const onDate = f.status === 'on_date';
      const fid = `friend:${f.profile_id}`;
      const friendSelected = selectedId === fid;
      let markerSize = MAP_PIN_MARKER_SIZE;
      if (friendSelected) {
        if (myCoords) {
          const d = haversineMeters(myCoords.latitude, myCoords.longitude, f.lat, f.lng);
          markerSize =
            d <= FRIEND_CAMERA_SKIP_MAX_METERS
              ? MAP_PIN_FRIEND_SELECTED_NEAR
              : MAP_PIN_FRIEND_SELECTED_FAR;
        } else {
          markerSize = MAP_PIN_FRIEND_SELECTED_FAR;
        }
      }
      out.push({
        id: fid,
        latitude: f.lat,
        longitude: f.lng,
        badge: onDate ? 'On a Date' : 'Circle',
        badgeVariant: onDate ? 'date' : 'glass',
        initial: initialLetter(displayName(f)),
        markerSize,
      });
    }
    return out;
  }, [friends, myCoords, myFirstName, myLive?.status, selectedId, user?.id, user?.email]);

  const selectedFriend = useMemo(() => {
    if (!selectedId?.startsWith('friend:')) return null;
    const pid = selectedId.slice('friend:'.length);
    return friends.find((f) => f.profile_id === pid) ?? null;
  }, [friends, selectedId]);

  useEffect(() => {
    if (selectedId == null) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedId(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    if (selectedId == null) {
      setSheetPinLocationLine(null);
      setSheetPinLocationLoading(false);
      return undefined;
    }
    const self = selectedId.startsWith('me:');
    const lat = self ? myCoords?.latitude ?? null : selectedFriend?.lat ?? null;
    const lng = self ? myCoords?.longitude ?? null : selectedFriend?.lng ?? null;
    if (lat == null || lng == null) {
      setSheetPinLocationLine(null);
      setSheetPinLocationLoading(false);
      return undefined;
    }
    const key = geocodeCacheKey(lat, lng);
    const cached = geocodeCacheRef.current.get(key);
    if (cached !== undefined) {
      setSheetPinLocationLine(cached.length > 0 ? cached : '');
      setSheetPinLocationLoading(false);
      return undefined;
    }
    setSheetPinLocationLoading(true);
    setSheetPinLocationLine(null);
    void (async () => {
      try {
        const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (cancelled) return;
        const a = rows[0];
        let line = '';
        if (a) {
          const formatted = formatGeocodedAddress(a);
          line = formatted.trim() ? formatted : '';
        }
        geocodeCacheRef.current.set(key, line);
        setSheetPinLocationLine(line);
      } catch {
        if (!cancelled) {
          geocodeCacheRef.current.set(key, '');
          setSheetPinLocationLine('');
        }
      } finally {
        if (!cancelled) setSheetPinLocationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedFriend, myCoords?.latitude, myCoords?.longitude]);

  const hourValues = useMemo(() => Array.from({ length: CUSTOM_HOUR_MAX + 1 }, (_, i) => i), []);
  const minuteValues = useMemo(
    () => Array.from({ length: CUSTOM_MINUTE_MAX + 1 }, (_, i) => i),
    [],
  );
  const selectedCompanion = useMemo(
    () => roster.find((item) => item.id === selectedRosterId) ?? null,
    [roster, selectedRosterId],
  );
  const selectedDurationLabel = useMemo(() => {
    const h = Math.floor(timerChoice / 60);
    const m = timerChoice % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }, [timerChoice]);

  /** Review step copy: "2 hrs", "1 hr 30 min", etc. */
  const reviewDurationFriendly = useMemo(() => {
    const h = Math.floor(timerChoice / 60);
    const m = timerChoice % 60;
    if (h > 0 && m === 0) return h === 1 ? '1 hr' : `${h} hrs`;
    if (h > 0 && m > 0) return `${h === 1 ? '1 hr' : `${h} hrs`} ${m} min`;
    return `${m} min`;
  }, [timerChoice]);

  /** "4hr 30m" style for custom picker preview line */
  const customDurationPreviewText = useMemo(() => {
    const h = customHours;
    const m = customMinutes;
    if (h > 0 && m > 0) return `${h}hr ${m}m`;
    if (h > 0) return `${h}hr`;
    return `${m}m`;
  }, [customHours, customMinutes]);

  const openDateModal = useCallback(() => {
    setDateModalOpen(true);
    if (!durationChoiceId && timerChoice > 0) {
      const preset = DATE_DURATION_OPTIONS.find((opt) => opt.minutes === timerChoice);
      if (preset) setDurationChoiceId(preset.id);
      else setDurationChoiceId('custom');
    }
    if (!selectedRosterId) {
      setDateSetupStep(1);
    }
    if (!user?.id) return;
    setRosterLoading(true);
    void listRosterPeople(user.id, false)
      .then((rows) => setRoster(rows))
      .catch(() => setRoster([]))
      .finally(() => setRosterLoading(false));
    void refreshMyDateState();
  }, [durationChoiceId, refreshMyDateState, selectedRosterId, timerChoice, user?.id]);

  const toStep = useCallback((target: 1 | 2 | 3) => {
    setDateSetupStep(target);
  }, []);

  const applyPresetDuration = useCallback((id: string, minutes: number) => {
    setDurationChoiceId(id);
    setTimerChoice(minutes);
  }, []);

  const openCustomPicker = useCallback(() => {
    const existing = Math.max(1, Math.min(1440, timerChoice));
    setCustomHours(Math.floor(existing / 60));
    setCustomMinutes(existing % 60);
    setCustomPickerOpen(true);
  }, [timerChoice]);

  const confirmCustomDuration = useCallback(() => {
    const safeH = Math.max(0, Math.min(CUSTOM_HOUR_MAX, customHours));
    const safeM = Math.max(0, Math.min(CUSTOM_MINUTE_MAX, customMinutes));
    const next = Math.max(1, Math.min(1440, safeH * 60 + safeM));
    setCustomHours(Math.floor(next / 60));
    setCustomMinutes(next % 60);
    setTimerChoice(next);
    setDurationChoiceId('custom');
    setCustomPickerOpen(false);
  }, [customHours, customMinutes]);

  const onCloseDateModal = useCallback(() => {
    setDateModalOpen(false);
    setCustomPickerOpen(false);
  }, []);

  const onWheelEnd = useCallback(
    (
      e: NativeSyntheticEvent<NativeScrollEvent>,
      max: number,
      setter: (value: number) => void,
      ref: { current: FlatList<number> | null },
    ) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.max(0, Math.min(max, Math.round(y / WHEEL_ROW_HEIGHT)));
      setter(idx);
      ref.current?.scrollToOffset({
        offset: idx * WHEEL_ROW_HEIGHT,
        animated: true,
      });
    },
    [],
  );

  const onHourWheelScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(CUSTOM_HOUR_MAX, Math.round(y / WHEEL_ROW_HEIGHT)));
    setCustomHours((prev) => (prev === idx ? prev : idx));
  }, []);

  const onMinuteWheelScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(CUSTOM_MINUTE_MAX, Math.round(y / WHEEL_ROW_HEIGHT)));
    setCustomMinutes((prev) => (prev === idx ? prev : idx));
  }, []);

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
      const sessionId = await startDateSession({
        rosterPersonId: selectedRosterId,
        timerMinutes: timerChoice,
        lat: myCoords.latitude,
        lng: myCoords.longitude,
        accuracy: null,
      });
      void notifyCircleDateModeStarted(sessionId);
      await refreshMyDateState();
      await refreshFriends();
      setDateModalOpen(false);
      setSelectedRosterId(null);
      setDateSetupStep(1);
      setDurationChoiceId(null);
    } catch (e) {
      Alert.alert('Could not start', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setDateActionLoading(false);
    }
  }, [myCoords, refreshFriends, refreshMyDateState, selectedRosterId, timerChoice, user?.id]);

  const sendSafety = useCallback(
    async (kind: DateSafetyKind) => {
      if (!mySession?.id) return;
      setSafetySignalLoading(true);
      try {
        const sent = await sendDateSafetySignal(mySession.id, kind);
        Alert.alert(
          sent === 0 ? 'No push sent' : 'Sent',
          sent === 0
            ? 'No friends have push notifications set up yet.'
            : kind === 'im_safe'
              ? 'Your circle was notified you marked yourself safe.'
              : 'Your circle was alerted.',
        );
      } catch (e) {
        Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.');
      } finally {
        setSafetySignalLoading(false);
      }
    },
    [mySession?.id],
  );

  const onTapSafety = useCallback(
    (kind: DateSafetyKind) => {
      if (!mySession?.id || safetySignalLoading) return;
      if (kind === 'alert_circle') {
        Alert.alert('Alert your circle?', 'Friends get a push so they can check in.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send alert',
            style: 'destructive',
            onPress: () => {
              void sendSafety('alert_circle');
            },
          },
        ]);
        return;
      }
      void sendSafety('im_safe');
    },
    [mySession?.id, safetySignalLoading, sendSafety],
  );

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

  const focusFriendOnMap = useCallback(
    (latitude: number, longitude: number, profileId: string) => {
      setSelectedId(`friend:${profileId}`);
      if (!myCoords) {
        mapRef.current?.animateToRegion(
          regionForFriendFocus(latitude, longitude),
          FRIEND_PIN_FOCUS_MS,
        );
        return;
      }
      const d = haversineMeters(myCoords.latitude, myCoords.longitude, latitude, longitude);
      if (d <= FRIEND_CAMERA_SKIP_MAX_METERS) {
        return;
      }
      mapRef.current?.animateToRegion(
        regionForFriendFocus(latitude, longitude),
        FRIEND_PIN_FOCUS_MS,
      );
    },
    [myCoords],
  );

  const onOpenPin = useCallback(
    (pin: PinModel) => {
      if (pin.id.startsWith('me:')) {
        setSelectedId(pin.id);
        mapRef.current?.animateToRegion(
          computeSelfSnapRegion(pin.latitude, pin.longitude),
          SELF_PIN_FOCUS_MS,
        );
        return;
      }
      if (!pin.id.startsWith('friend:')) return;
      const profileId = pin.id.slice('friend:'.length);
      focusFriendOnMap(pin.latitude, pin.longitude, profileId);
    },
    [computeSelfSnapRegion, focusFriendOnMap],
  );

  const onMapPress = useCallback(
    (e: MapPressEvent) => {
      if (e.nativeEvent.action === 'marker-press') return;
      if (!myCoords) return;
      if (selectedId != null) setSelectedId(null);
      mapRef.current?.animateToRegion(
        computeSelfSnapRegion(myCoords.latitude, myCoords.longitude),
        SELF_PIN_FOCUS_MS,
      );
    },
    [computeSelfSnapRegion, myCoords, selectedId],
  );

  /** Pull down at top of profile scroll → expand sheet (same idea as dragging the handle up). */
  const handleSheetDetailScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (selectedId == null) return;
      const y = e.nativeEvent.contentOffset.y;
      detailScrollYRef.current = y;
      if (y < -10 && sheetVisualOffset > 8) {
        animateSheetTo(0);
      }
    },
    [animateSheetTo, selectedId, sheetVisualOffset],
  );

  const detailFriend = selectedFriend;
  const detailSelf = selectedId?.startsWith('me:');
  const sheetDetailLat =
    detailSelf && myCoords ? myCoords.latitude : (detailFriend?.lat ?? null);
  const sheetDetailLng =
    detailSelf && myCoords ? myCoords.longitude : (detailFriend?.lng ?? null);
  const activeDateCountdown = useMemo(
    () => timerLine(mySession?.started_at ?? null, mySession?.timer_minutes ?? null, Date.now()),
    [mySession?.started_at, mySession?.timer_minutes, tick],
  );

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
        mapPadding={mapEdgePadding}
        showsPointsOfInterest
        showsBuildings
        showsUserLocation={false}
        toolbarEnabled={false}
        onMapReady={() => {
          const c = myCoordsRef.current;
          if (c) scheduleSnapCameraToUser(c.latitude, c.longitude);
        }}
        onPress={onMapPress}
      >
        {pins.map((p) => (
          <PinMarker key={`${p.id}-${p.markerSize}`} pin={p} onOpen={onOpenPin} />
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Date mode"
          onPress={openDateModal}
          style={({ pressed }) => [
            styles.dateFabHit,
            {
              top: insets.top + (locPerm === 'denied' || mapLoadError ? 72 : spacing.sm),
              right: containerMargin,
            },
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={[colors.sageGradientStart, colors.sageGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.dateFab,
              mySession?.status === 'active' && styles.dateFabActive,
            ]}
          >
            <Heart
              color={colors.ctaGradientStart}
              fill={colors.ctaGradientStart}
              size={20}
              strokeWidth={2}
            />
            <View>
              <Text style={styles.dateFabLabel}>
                {mySession?.status === 'active' ? 'On date' : 'Date mode'}
              </Text>
              {mySession?.status === 'active' && activeDateCountdown ? (
                <Text style={styles.dateFabTimer}>
                  {activeDateCountdown.replace(' remaining', '')}
                </Text>
              ) : null}
            </View>
          </LinearGradient>
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              bottom: sheetBottom,
              left: 0,
              right: 0,
              height: circleSheetHeightLive,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={[styles.sheetTint, selectedId != null && styles.sheetTintDetail]} />
          <View style={styles.sheetHandle} {...sheetHandleDragPan.panHandlers}>
            <View style={styles.sheetGrab} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sheetExpanded ? 'Collapse circle sheet' : 'Expand circle sheet'}
              onPress={() => {
                animateSheetTo(sheetExpanded ? collapsedSheetOffset : 0);
              }}
              style={styles.sheetToggleHit}
            />
          </View>
          <View style={styles.sheetBody}>
            {selectedId == null ? (
              <>
                <Text style={styles.sheetTitle}>Circle</Text>
                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.sheetScrollInner}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={sheetExpanded}
                >
                  {!user?.id ? (
                    <Text style={styles.emptyText}>Sign in to see your circle on the map.</Text>
                  ) : sortedSheet.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {friends.length === 0
                        ? 'Add accepted friends in Circles to see them here. When they share location on the Map tab, pins appear.'
                        : 'No circle members yet.'}
                    </Text>
                  ) : (
                    sortedSheet.map((person) => {
                      const name = displayName(person);
                      const hasPin = person.lat != null && person.lng != null;
                      const sub = !hasPin
                        ? 'Has not shared location yet'
                        : person.status === 'on_date'
                          ? `With ${person.companion_display_name ?? 'someone'} · ${formatUpdated(person.updated_at)}`
                          : `Last updated ${formatUpdated(person.updated_at)}`;
                      return (
                        <Pressable
                          key={person.profile_id}
                          onPress={() => {
                            if (hasPin && person.lat != null && person.lng != null) {
                              focusFriendOnMap(person.lat, person.lng, person.profile_id);
                            } else {
                              Alert.alert(
                                name,
                                'They have not turned on location sharing yet. Ask them to open Map with location enabled.',
                              );
                            }
                          }}
                          style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
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
              </>
            ) : (
              <>
                <View style={styles.sheetInlineDetailHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to circle list"
                    onPress={() => setSelectedId(null)}
                    style={({ pressed }) => [styles.sheetDetailBackHit, pressed && styles.pressed]}
                  >
                    <ChevronLeft color={colors.onSurface} size={22} strokeWidth={2} />
                  </Pressable>
                  <View style={styles.sheetDetailTitlePanArea} {...sheetDetailTitleDragPan.panHandlers}>
                    <Text style={styles.sheetDetailTitle} numberOfLines={1}>
                      {detailSelf ? 'You' : detailFriend ? displayName(detailFriend) : 'Circle'}
                    </Text>
                  </View>
                </View>
                <View style={styles.sheetDetailScrollPanWrap} {...detailProfileScrollPullPan.panHandlers}>
                  <ScrollView
                    style={styles.sheetScroll}
                    contentContainerStyle={styles.sheetDetailScrollInner}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={sheetExpanded}
                    alwaysBounceVertical={sheetExpanded}
                    scrollEventThrottle={16}
                    onScroll={handleSheetDetailScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                  {detailSelf ? (
                    <View style={styles.sheetDetailSection}>
                      <Text style={styles.sheetDetailMeta}>
                        {myLive?.status === 'on_date'
                          ? `On a date with ${mySession?.companion_display_name ?? '…'}`
                          : 'Sharing location with your circle while this tab is open.'}
                      </Text>
                      {mySession?.started_at ? (
                        <Text style={styles.sheetDetailHint}>
                          Started {formatSessionClock(mySession.started_at)}
                        </Text>
                      ) : null}
                      {mySession?.timer_minutes ? (
                        <Text style={styles.sheetDetailMeta}>
                          {timerLine(mySession.started_at, mySession.timer_minutes, Date.now())}
                        </Text>
                      ) : null}
                      {mySession?.companion_ai_summary ? (
                        <View style={styles.sheetDetailSummary}>
                          <Text style={styles.sheetDetailSummaryLabel}>Roster snapshot</Text>
                          <Text style={styles.sheetDetailSummaryText}>{mySession.companion_ai_summary}</Text>
                        </View>
                      ) : null}
                      <SheetLocationCardView
                        loading={sheetPinLocationLoading}
                        address={sheetPinLocationLine}
                        muted={
                          !sheetPinLocationLoading &&
                          sheetDetailLat != null &&
                          sheetDetailLng != null &&
                          (!sheetPinLocationLine || isLatCommaLngOnly(sheetPinLocationLine))
                            ? 'Street address couldn’t be resolved for your current pin.'
                            : ''
                        }
                      />
                    </View>
                  ) : detailFriend ? (
                    <View style={styles.sheetDetailSection}>
                      {detailFriend.status === 'on_date' ? (
                        <>
                          <Text style={styles.sheetDetailMeta}>
                            {`On a date with ${detailFriend.companion_display_name ?? 'someone'}`}
                          </Text>
                          {detailFriend.session_started_at ? (
                            <Text style={styles.sheetDetailHint}>
                              Date started {formatSessionClock(detailFriend.session_started_at)}
                            </Text>
                          ) : null}
                          {detailFriend.session_started_at && detailFriend.timer_minutes ? (
                            <Text style={styles.sheetDetailMeta}>
                              {timerLine(
                                detailFriend.session_started_at,
                                detailFriend.timer_minutes,
                                Date.now(),
                              )}
                            </Text>
                          ) : null}
                          {detailFriend.companion_ai_summary ? (
                            <View style={styles.sheetDetailSummary}>
                              <Text style={styles.sheetDetailSummaryLabel}>Their roster snapshot</Text>
                              <Text style={styles.sheetDetailSummaryText}>
                                {detailFriend.companion_ai_summary}
                              </Text>
                            </View>
                          ) : null}
                          <SheetLocationCardView
                            loading={sheetPinLocationLoading}
                            address={sheetPinLocationLine}
                            muted={
                              !sheetPinLocationLoading &&
                              sheetDetailLat != null &&
                              sheetDetailLng != null &&
                              (!sheetPinLocationLine || isLatCommaLngOnly(sheetPinLocationLine))
                                ? 'Street address couldn’t be resolved for their pin.'
                                : !sheetPinLocationLoading &&
                                    (sheetDetailLat == null || sheetDetailLng == null)
                                  ? 'They haven’t shared a location yet.'
                                  : ''
                            }
                          />
                        </>
                      ) : (
                        <>
                          <SheetLocationCardView
                            loading={sheetPinLocationLoading}
                            address={sheetPinLocationLine}
                            muted={
                              !sheetPinLocationLoading &&
                              sheetDetailLat != null &&
                              sheetDetailLng != null &&
                              (!sheetPinLocationLine || isLatCommaLngOnly(sheetPinLocationLine))
                                ? 'Street address couldn’t be resolved for their pin.'
                                : !sheetPinLocationLoading &&
                                    (sheetDetailLat == null || sheetDetailLng == null)
                                  ? 'They haven’t shared a location yet.'
                                  : ''
                            }
                          />
                          <View style={styles.sheetUpdatedRow}>
                            <CalendarClock
                              color={colors.onSurfaceVariant}
                              size={16}
                              strokeWidth={2}
                            />
                            <Text style={styles.sheetLastUpdatedInline}>
                              Last updated {formatUpdated(detailFriend.updated_at)}
                            </Text>
                          </View>
                          {detailFriend.companion_ai_summary ? (
                            <View style={styles.sheetDetailSummary}>
                              <Text style={styles.sheetDetailSummaryLabel}>Their roster snapshot</Text>
                              <Text style={styles.sheetDetailSummaryText}>
                                {detailFriend.companion_ai_summary}
                              </Text>
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>
                  ) : null}
                  </ScrollView>
                </View>
              </>
            )}
          </View>
        </Animated.View>

      </View>

      <Modal visible={dateModalOpen} animationType="slide" onRequestClose={onCloseDateModal}>
        <View style={styles.datePlanScreen}>
          <ScreenGradient />

          {mySession?.status === 'active' ? (
            <>
              <View style={[styles.datePlanHeader, { paddingTop: insets.top + spacing.sm }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={onCloseDateModal}
                  style={({ pressed }) => [styles.datePlanHeaderBtn, pressed && styles.pressed]}
                >
                  <ChevronLeft color={colors.ink} size={24} strokeWidth={1.75} />
                </Pressable>
                <Text style={styles.datePlanNavTitle}>Date mode</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onCloseDateModal}
                  style={({ pressed }) => [styles.datePlanHeaderBtn, pressed && styles.pressed]}
                >
                  <X color={colors.ink} size={24} strokeWidth={2} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.datePlanScrollView}
                contentContainerStyle={styles.datePlanScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.dateActivePillLabel}>Active date</Text>
                <View style={styles.dateActiveCard}>
                  <View style={styles.dateActiveCardTop}>
                    <View
                      style={[
                        styles.dateActiveAvatar,
                        { backgroundColor: companionAvatarColor(mySession.roster_person_id) },
                      ]}
                    >
                      <Text style={styles.dateActiveAvatarText}>
                        {companionInitials(mySession.companion_display_name)}
                      </Text>
                    </View>
                    <View style={styles.dateActiveCardTopText}>
                      <Text style={styles.dateActiveCompanionName} numberOfLines={1}>
                        {mySession.companion_display_name}
                      </Text>
                      {mySession.started_at ? (
                        <Text style={styles.dateActiveStarted}>
                          Started: {formatSessionClock(mySession.started_at) ?? '—'}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {mySession.timer_minutes ? (
                    <View style={styles.dateActiveTimerBand}>
                      <View style={styles.dateActiveTimerLeft}>
                        <ShieldCheck size={18} color={colors.riskLowInk} strokeWidth={2} />
                        <Text style={styles.dateActiveTimerLabel}>Remaining time</Text>
                      </View>
                      <Text style={styles.dateActiveTimerValue}>
                        {countdownDigits(activeDateCountdown)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.dateActiveSafetyStack}>
                  <Pressable
                    onPress={() => onTapSafety('im_safe')}
                    disabled={safetySignalLoading || dateActionLoading}
                    style={({ pressed }) => [
                      styles.dateActiveSafeBtn,
                      pressed && styles.pressed,
                      (safetySignalLoading || dateActionLoading) && styles.disabledBtn,
                    ]}
                  >
                    <ShieldCheck size={20} color={colors.white} strokeWidth={2} />
                    <Text style={styles.dateActiveSafeBtnText}>I&apos;m safe</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onTapSafety('alert_circle')}
                    disabled={safetySignalLoading || dateActionLoading}
                    style={({ pressed }) => [
                      styles.dateActiveAlertBtn,
                      pressed && styles.pressed,
                      (safetySignalLoading || dateActionLoading) && styles.disabledBtn,
                    ]}
                  >
                    <AlertTriangle size={20} color={colors.white} strokeWidth={2} />
                    <Text style={styles.dateActiveAlertBtnText}>Alert circle</Text>
                  </Pressable>
                </View>
              </ScrollView>
              <View
                style={[styles.datePlanFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
              >
                <Button
                  label="End date"
                  loading={dateActionLoading}
                  disabled={dateActionLoading}
                  onPress={() => {
                    void onEndDate();
                  }}
                />
              </View>
            </>
          ) : dateSetupStep === 1 ? (
            <>
              <View style={[styles.datePlanHeader, { paddingTop: insets.top + spacing.sm }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={onCloseDateModal}
                  style={({ pressed }) => [styles.datePlanHeaderBtn, pressed && styles.pressed]}
                >
                  <ChevronLeft color={colors.ink} size={24} strokeWidth={1.75} />
                </Pressable>
                <Text style={styles.datePlanNavTitle}>Select time</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onCloseDateModal}
                  style={({ pressed }) => [styles.datePlanHeaderBtn, pressed && styles.pressed]}
                >
                  <X color={colors.ink} size={24} strokeWidth={2} />
                </Pressable>
              </View>
              <DatePlanProgressBar activeStep={1} />
              <ScrollView
                style={styles.datePlanScrollView}
                contentContainerStyle={styles.datePlanScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.datePlanHeadline}>
                  Plan your <Text style={styles.datePlanHeadlineAccent}>date</Text>
                </Text>
                <Text style={styles.datePlanLead}>
                  Great, you are going on a date. How long do you plan to spend with your new flame?
                </Text>
                <View style={styles.datePlanDurationList}>
                  {DATE_DURATION_OPTIONS.map((opt) => {
                    const on = durationChoiceId === opt.id;
                    const Icon = DURATION_OPTION_ICONS[opt.id] ?? Clock;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => applyPresetDuration(opt.id, opt.minutes)}
                        style={({ pressed }) => [
                          styles.datePlanDurationCard,
                          on && styles.datePlanDurationCardOn,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.datePlanIconWell}>
                          <Icon color={colors.cta} size={22} strokeWidth={2} />
                        </View>
                        <View style={styles.datePlanDurationText}>
                          <Text style={styles.datePlanDurationLabel}>{opt.label}</Text>
                          <Text style={styles.datePlanDurationSub}>{opt.subtitle}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={openCustomPicker}
                    style={({ pressed }) => [
                      styles.datePlanDurationCard,
                      durationChoiceId === 'custom' && styles.datePlanDurationCardOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.datePlanIconWell}>
                      <Clock color={colors.cta} size={22} strokeWidth={2} />
                    </View>
                    <View style={styles.datePlanDurationText}>
                      <Text style={styles.datePlanDurationLabel}>Custom</Text>
                      <Text style={styles.datePlanDurationSub}>
                        {durationChoiceId === 'custom'
                          ? `Selected: ${selectedDurationLabel}`
                          : 'Add custom hours and minutes.'}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </ScrollView>
              <View
                style={[styles.datePlanFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
              >
                <Button
                  label="Next"
                  disabled={!durationChoiceId}
                  onPress={() => toStep(2)}
                />
              </View>
            </>
          ) : dateSetupStep === 2 ? (
            <>
              <View style={[styles.datePlanHeader, { paddingTop: insets.top + spacing.sm }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to select time"
                  onPress={() => toStep(1)}
                  style={({ pressed }) => [styles.datePlanHeaderBtn, pressed && styles.pressed]}
                >
                  <ChevronLeft color={colors.ink} size={24} strokeWidth={1.75} />
                </Pressable>
                <Text style={styles.datePlanNavTitleSans}>Choose companion</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onCloseDateModal}
                  style={({ pressed }) => [styles.datePlanHeaderBtn, pressed && styles.pressed]}
                >
                  <X color={colors.ink} size={24} strokeWidth={2} />
                </Pressable>
              </View>
              <DatePlanProgressBar activeStep={2} />
              <ScrollView
                style={styles.datePlanScrollView}
                contentContainerStyle={styles.datePlanScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.datePlanHeadline}>
                  Who are you <Text style={styles.datePlanHeadlineAccent}>meeting?</Text>
                </Text>
                <Text style={styles.datePlanLead}>
                  Connect with friends nearby and plan meetups effortlessly.
                </Text>
                {rosterLoading ? (
                  <ActivityIndicator style={{ marginVertical: spacing.xl }} color={colors.cta} />
                ) : roster.length === 0 ? (
                  <Text style={styles.datePlanEmptyRoster}>
                    Add someone to your roster first, then you can start date mode.
                  </Text>
                ) : (
                  <View style={styles.companionList}>
                    {roster.map((item) => {
                      const sel = selectedRosterId === item.id;
                      const initials = companionInitials(item.display_name);
                      const bg = companionAvatarColor(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setSelectedRosterId(item.id)}
                          style={({ pressed }) => [
                            styles.companionRow,
                            sel && styles.companionRowSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.companionAvatar, { backgroundColor: bg }]}>
                            <Text style={styles.companionAvatarText}>{initials}</Text>
                          </View>
                          <Text style={styles.companionName} numberOfLines={1}>
                            {item.display_name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
              <View
                style={[styles.datePlanFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
              >
                <Button
                  label="Next"
                  disabled={!selectedRosterId}
                  onPress={() => toStep(3)}
                />
              </View>
            </>
          ) : dateSetupStep === 3 ? (
            <>
              <View style={[styles.datePlanHeader, { paddingTop: insets.top + spacing.sm }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to choose companion"
                  onPress={() => toStep(2)}
                  style={({ pressed }) => [styles.datePlanHeaderBtn, pressed && styles.pressed]}
                >
                  <ChevronLeft color={colors.ink} size={24} strokeWidth={1.75} />
                </Pressable>
                <Text style={styles.datePlanNavTitle}>Ready to start</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onCloseDateModal}
                  style={({ pressed }) => [styles.datePlanHeaderBtn, pressed && styles.pressed]}
                >
                  <X color={colors.ink} size={24} strokeWidth={2} />
                </Pressable>
              </View>
              <DatePlanProgressBar activeStep={3} />
              <ScrollView
                style={styles.datePlanScrollView}
                contentContainerStyle={styles.datePlanScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.datePlanHeadline, { marginBottom: spacing.lg }]}>
                  All set. One tap and your circle can{' '}
                  <Text style={styles.datePlanHeadlineAccent}>follow up.</Text>
                </Text>
                <View style={styles.readyReviewCard}>
                  <View
                    style={[
                      styles.readyReviewAvatar,
                      {
                        backgroundColor: companionAvatarColor(
                          selectedRosterId ?? selectedCompanion?.id ?? '',
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.readyReviewAvatarText}>
                      {companionInitials(selectedCompanion?.display_name ?? '')}
                    </Text>
                  </View>
                  <View style={styles.readyReviewTextCol}>
                    <Text style={styles.readyReviewName} numberOfLines={2}>
                      {selectedCompanion?.display_name ?? 'No one selected'}
                    </Text>
                    <Text style={styles.readyReviewDuration}>
                      Duration: {reviewDurationFriendly}
                    </Text>
                  </View>
                </View>
              </ScrollView>
              <View
                style={[styles.datePlanFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
              >
                <Button
                  label="Start date"
                  loading={dateActionLoading}
                  disabled={!selectedRosterId || dateActionLoading}
                  onPress={() => {
                    void onStartDate();
                  }}
                />
              </View>
            </>
          ) : null}
          {customPickerOpen ? (
            <View style={styles.customLayer} pointerEvents="box-none">
              <Pressable style={styles.customBackdrop} onPress={() => setCustomPickerOpen(false)} />
              <View style={styles.customSheet}>
                <View style={styles.customSheetHeaderRow}>
                  <Text style={styles.customTitle}>Custom duration</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={12}
                    onPress={() => setCustomPickerOpen(false)}
                    style={({ pressed }) => [styles.customCloseBtn, pressed && styles.pressed]}
                  >
                    <X color={colors.ink} size={22} strokeWidth={2} />
                  </Pressable>
                </View>
                <View style={styles.wheelsWrap}>
                  <View style={styles.wheelColumn}>
                    <View style={styles.wheelViewport}>
                      <FlatList
                        ref={hoursListRef}
                        data={hourValues}
                        style={styles.wheelList}
                        keyExtractor={(h) => `h-${h}`}
                        renderItem={({ item }) => (
                          <View style={styles.wheelRow}>
                            <Text style={styles.wheelRowText}>
                              {String(item).padStart(2, '0')}
                            </Text>
                          </View>
                        )}
                        snapToInterval={WHEEL_ROW_HEIGHT}
                        snapToAlignment="start"
                        decelerationRate={WHEEL_DECELERATION_RATE}
                        bounces
                        alwaysBounceVertical
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.wheelPad}
                        scrollEventThrottle={8}
                        onScroll={onHourWheelScroll}
                        getItemLayout={(_, index) => ({
                          length: WHEEL_ROW_HEIGHT,
                          offset: WHEEL_ROW_HEIGHT * index,
                          index,
                        })}
                        onMomentumScrollEnd={(e) =>
                          onWheelEnd(e, CUSTOM_HOUR_MAX, setCustomHours, hoursListRef)
                        }
                      />
                      <View style={styles.wheelCenterFrost} pointerEvents="none" />
                      <View style={styles.wheelCenterRow} pointerEvents="none">
                        <Text style={styles.wheelCenterNumber}>
                          {String(customHours).padStart(2, '0')}
                        </Text>
                        <Text style={styles.wheelCenterUnit}>HOURS</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.wheelColumn}>
                    <View style={styles.wheelViewport}>
                      <FlatList
                        ref={minutesListRef}
                        data={minuteValues}
                        style={styles.wheelList}
                        keyExtractor={(m) => `m-${m}`}
                        renderItem={({ item }) => (
                          <View style={styles.wheelRow}>
                            <Text style={styles.wheelRowText}>
                              {String(item).padStart(2, '0')}
                            </Text>
                          </View>
                        )}
                        snapToInterval={WHEEL_ROW_HEIGHT}
                        snapToAlignment="start"
                        decelerationRate={WHEEL_DECELERATION_RATE}
                        bounces
                        alwaysBounceVertical
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.wheelPad}
                        scrollEventThrottle={8}
                        onScroll={onMinuteWheelScroll}
                        getItemLayout={(_, index) => ({
                          length: WHEEL_ROW_HEIGHT,
                          offset: WHEEL_ROW_HEIGHT * index,
                          index,
                        })}
                        onMomentumScrollEnd={(e) =>
                          onWheelEnd(e, CUSTOM_MINUTE_MAX, setCustomMinutes, minutesListRef)
                        }
                      />
                      <View style={styles.wheelCenterFrost} pointerEvents="none" />
                      <View style={styles.wheelCenterRow} pointerEvents="none">
                        <Text style={styles.wheelCenterNumber}>
                          {String(customMinutes).padStart(2, '0')}
                        </Text>
                        <Text style={styles.wheelCenterUnit}>MIN</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.customFooter}>
                  <Text style={styles.customPreview}>
                    Selected: {customDurationPreviewText}
                  </Text>
                  <Button label="Use time" onPress={confirmCustomDuration} />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <AppDock variant="connected" />
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
  dateFabHit: {
    position: 'absolute',
    zIndex: 31,
  },
  dateFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(31, 74, 56, 0.35)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  dateFabActive: {
    opacity: 0.94,
  },
  dateFabLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.2),
    color: '#FDE8EE',
    letterSpacing: 0.15,
  },
  dateFabTimer: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.2),
    color: 'rgba(253, 232, 238, 0.92)',
    marginTop: 1,
  },
  sheet: {
    position: 'absolute',
    zIndex: 120,
    borderTopLeftRadius: radii.dockTop,
    borderTopRightRadius: radii.dockTop,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  sheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.blush,
    borderWidth: 0,
  },
  /** Match circle list row cards so the profile readout feels like the same “popup”, not a tall white slab. */
  sheetTintDetail: {
    backgroundColor: colors.surfaceContainerLowest,
  },
  sheetHandle: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetGrab: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(201, 196, 213, 0.45)',
  },
  sheetToggleHit: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  sheetTitle: {
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
    fontFamily: fontFamily.displaySemiBold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.2),
    color: colors.ink,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  /** Wraps profile ScrollView so pull-down-at-top can drag the sheet (PanResponder capture). */
  sheetDetailScrollPanWrap: {
    flex: 1,
    minHeight: 0,
  },
  sheetInlineDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: containerMargin,
    paddingBottom: spacing.xs,
    gap: 6,
  },
  sheetDetailSection: {
    gap: 4,
  },
  sheetDetailMeta: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.42),
    color: colors.onSurfaceVariant,
  },
  sheetDetailHint: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.38),
    color: colors.tertiary,
  },
  /** Location: typography only + hairline — same restraint as the circle list (no tinted “card”). */
  sheetLocationPlain: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    gap: spacing.xs,
  },
  sheetUpdatedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.md,
    paddingHorizontal: 2,
  },
  sheetLastUpdatedInline: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.45),
    color: colors.onSurfaceVariant,
  },
  sheetDetailSummary: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLow,
    gap: 4,
  },
  sheetDetailSummaryLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
  },
  sheetDetailSummaryText: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.42),
    color: colors.onSurface,
  },
  sheetDetailBackHit: {
    padding: 6,
    marginRight: 2,
  },
  sheetDetailTitlePanArea: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  sheetDetailTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.35),
    color: colors.onSurface,
  },
  sheetDetailScrollInner: {
    paddingHorizontal: containerMargin,
    paddingBottom: spacing.xs,
    gap: 4,
  },
  sheetScrollInner: {
    paddingHorizontal: 12,
    paddingBottom: 4,
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
    backgroundColor: colors.card,
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
    width: MAP_PIN_MARKER_SIZE,
    height: MAP_PIN_MARKER_SIZE,
    borderRadius: MAP_PIN_MARKER_SIZE / 2,
    backgroundColor: colors.primaryFixed,
    borderWidth: 1,
    borderColor: 'rgba(201, 196, 213, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitial: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
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
    color: colors.ink,
  },
  personSub: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.meta,
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
  datePlanScreen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: containerMargin,
  },
  datePlanHeader: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  datePlanHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -8,
  },
  datePlanHeaderSide: {
    width: 44,
    height: 44,
  },
  datePlanNavTitle: {
    fontFamily: fontFamily.display,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.2),
    color: colors.ink,
  },
  datePlanNavTitleSans: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.2),
    color: colors.ink,
  },
  datePlanProgressRow: {
    zIndex: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  datePlanProgressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(122, 103, 112, 0.28)',
  },
  datePlanProgressSegActive: {
    backgroundColor: colors.ink,
    height: 5,
    borderRadius: 2.5,
  },
  datePlanScrollView: {
    zIndex: 1,
    flex: 1,
  },
  datePlanScroll: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },
  datePlanHeadline: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: typeScale.headlineLg,
    lineHeight: lineHeight(typeScale.headlineLg, 1.08),
    color: colors.ink,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  datePlanHeadlineAccent: {
    fontFamily: fontFamily.displayItalic,
    color: colors.cta,
  },
  datePlanLead: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.5),
    color: colors.meta,
    marginBottom: spacing.lg,
  },
  datePlanEmptyRoster: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.45),
    color: colors.meta,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  companionList: {
    gap: spacing.sm,
  },
  companionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(26, 17, 24, 0.06)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  companionRowSelected: {
    backgroundColor: colors.primaryFixed,
    borderColor: 'rgba(168, 53, 90, 0.28)',
  },
  companionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionAvatarText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.white,
    letterSpacing: 0.3,
  },
  companionName: {
    flex: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.35),
    color: colors.ink,
  },
  datePlanDurationList: {
    gap: spacing.sm,
  },
  datePlanDurationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(26, 17, 24, 0.08)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  datePlanDurationCardOn: {
    borderColor: colors.cta,
  },
  datePlanIconWell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePlanDurationText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  datePlanDurationLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.25),
    color: colors.ink,
  },
  datePlanDurationSub: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.4),
    color: colors.meta,
  },
  datePlanFooter: {
    zIndex: 1,
    paddingTop: spacing.md,
  },
  readyReviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    ...Platform.select({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  readyReviewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyReviewAvatarText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    color: colors.white,
    letterSpacing: 0.3,
  },
  readyReviewTextCol: {
    flex: 1,
    gap: 4,
  },
  readyReviewName: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.35),
    color: colors.ink,
  },
  readyReviewDuration: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.35),
    color: colors.meta,
  },
  dateActivePillLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.meta,
    marginBottom: spacing.sm,
  },
  dateActiveCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  dateActiveCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateActiveAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateActiveAvatarText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    color: colors.white,
    letterSpacing: 0.3,
  },
  dateActiveCardTopText: {
    flex: 1,
    gap: 4,
  },
  dateActiveCompanionName: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.35),
    color: colors.ink,
  },
  dateActiveStarted: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.35),
    color: colors.meta,
  },
  dateActiveTimerBand: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.riskLowBg,
  },
  dateActiveTimerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateActiveTimerLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.35),
    color: colors.riskLowInk,
  },
  dateActiveTimerValue: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.2),
    color: colors.riskLowInk,
    fontVariant: ['tabular-nums'],
  },
  dateActiveSafetyStack: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  dateActiveSafeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.sageGradientEnd,
  },
  dateActiveSafeBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.white,
  },
  dateActiveAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.alert,
  },
  dateActiveAlertBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.white,
  },
  backPill: {
    minWidth: 56,
    borderRadius: radii.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  backPillDisabled: {
    opacity: 0.35,
  },
  backPillLabel: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  stepLead: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.45),
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  durationList: {
    gap: spacing.sm,
  },
  durationCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.md,
    gap: 4,
  },
  durationCardOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  durationLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    color: colors.onSurface,
  },
  durationSub: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    color: colors.onSurfaceVariant,
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
  finalStartBtn: {
    marginTop: spacing.md,
    paddingVertical: 20,
    borderRadius: radii.lg,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  customBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  customLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  customSheet: {
    position: 'relative',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: containerMargin,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  customSheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  customCloseBtn: {
    padding: 4,
  },
  customTitle: {
    flex: 1,
    fontFamily: fontFamily.displaySemiBold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.2),
    color: colors.ink,
  },
  wheelsWrap: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  wheelColumn: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ghostBorder,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  wheelViewport: {
    position: 'relative',
    overflow: 'hidden',
  },
  wheelList: {
    height: WHEEL_ROW_HEIGHT * WHEEL_VISIBLE_ROWS,
  },
  wheelPad: {
    paddingVertical: WHEEL_ROW_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2),
  },
  wheelRow: {
    minHeight: WHEEL_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelRowText: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    lineHeight: WHEEL_ROW_HEIGHT,
    color: colors.meta,
    opacity: 0.5,
  },
  wheelCenterFrost: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_ROW_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2),
    height: WHEEL_ROW_HEIGHT,
    backgroundColor: colors.card,
    zIndex: 1,
  },
  wheelCenterRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_ROW_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2),
    height: WHEEL_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 2,
  },
  wheelCenterNumber: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 34,
    lineHeight: 38,
    color: colors.cta,
    letterSpacing: -0.5,
  },
  wheelCenterUnit: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.cta,
  },
  customFooter: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  customPreview: {
    textAlign: 'center',
    fontFamily: fontFamily.displayItalic,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.cta,
  },
});

type SheetLocationCardViewProps = {
  loading: boolean;
  address: string | null;
  muted: string | null | undefined;
};

function SheetLocationCardView({ loading, address, muted }: SheetLocationCardViewProps) {
  const trimmedMuted = (muted ?? '').trim();
  const lines =
    !loading && address && !isLatCommaLngOnly(address) ? splitAddressForDisplay(address) : null;

  if (!loading && !lines?.primary && !trimmedMuted) {
    return null;
  }

  return (
    <View style={styles.sheetLocationPlain}>
      {loading ? (
        <Text style={styles.personSub}>Getting address…</Text>
      ) : lines?.primary ? (
        <View style={styles.sheetDetailSection}>
          <Text style={styles.personName}>{lines.primary}</Text>
          {lines.secondary ? <Text style={styles.personSub}>{lines.secondary}</Text> : null}
        </View>
      ) : trimmedMuted ? (
        <Text style={styles.personSub}>{trimmedMuted}</Text>
      ) : null}
    </View>
  );
}
