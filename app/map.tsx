import { BlurView } from 'expo-blur';
import {
  Footprints,
  Heart,
  Home,
  Mic,
  Search,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock } from '../components/AppDock';
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

const SEATTLE = {
  latitude: 47.6062,
  longitude: -122.3321,
  latitudeDelta: 0.055,
  longitudeDelta: 0.055,
};

type PinDef = {
  id: string;
  latitude: number;
  longitude: number;
  badge: string;
  badgeVariant: 'primary' | 'glass' | 'date';
  initial: string;
  markerSize: number;
};

const MAP_PINS: PinDef[] = [
  {
    id: 'you',
    latitude: 47.6062,
    longitude: -122.3321,
    badge: 'At Home',
    badgeVariant: 'primary',
    initial: 'Y',
    markerSize: 64,
  },
  {
    id: 'marcus',
    latitude: 47.618,
    longitude: -122.305,
    badge: 'Walking',
    badgeVariant: 'glass',
    initial: 'M',
    markerSize: 56,
  },
  {
    id: 'elena',
    latitude: 47.598,
    longitude: -122.355,
    badge: 'On a Date',
    badgeVariant: 'date',
    initial: 'E',
    markerSize: 56,
  },
];

type PersonRow = {
  id: string;
  name: string;
  subtitle: string;
  initial: string;
  status: 'walk' | 'date';
  battery: string;
  batteryLow?: boolean;
};

const SHEET_PEOPLE: PersonRow[] = [
  {
    id: '1',
    name: 'Marcus Chen',
    subtitle: 'Walking near Pike Place Market',
    initial: 'M',
    status: 'walk',
    battery: '85%',
  },
  {
    id: '2',
    name: 'Elena Rodriguez',
    subtitle: 'At The Golden Roast Cafe',
    initial: 'E',
    status: 'date',
    battery: '12%',
    batteryLow: true,
  },
];

function PinMarker({
  pin,
  onOpen,
}: {
  pin: PinDef;
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
      onPress={() => {
        onOpen(pin.id);
      }}
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
            <Text style={[styles.badgeLabel, badgeTextStyles]}>{pin.badge}</Text>
          </View>
          <View
            style={[
              styles.avatarDisc,
              { width: s, height: s, borderRadius: s / 2 },
              pinGlow,
            ]}
          >
            <Text style={[styles.avatarInitial, { fontSize: s * 0.32 }]}>
              {pin.initial}
            </Text>
          </View>
          <View style={styles.tail} />
        </View>
      </View>
    </Marker>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const dockH = useMemo(() => getDockOuterHeight(insets.bottom), [insets.bottom]);
  const sheetBottom = dockH + spacing.sm;

  const sheetPeopleSorted = useMemo(
    () =>
      [...SHEET_PEOPLE].sort((a, b) => {
        const da = a.status === 'date' ? 0 : 1;
        const db = b.status === 'date' ? 0 : 1;
        return da - db;
      }),
    [],
  );

  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
  const mapStyle =
    Platform.OS === 'android'
      ? [...mapGoogleLightStyle]
      : undefined;

  const onPin = useCallback((id: string) => {
    console.log('map pin', id);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={SEATTLE}
        provider={mapProvider}
        customMapStyle={mapStyle}
        mapType="standard"
        showsPointsOfInterest
        showsBuildings
        showsUserLocation={false}
        toolbarEnabled={false}
      >
        {MAP_PINS.map((p) => (
          <PinMarker key={p.id} pin={p} onOpen={onPin} />
        ))}
      </MapView>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.searchWrap,
            {
              top: insets.top + spacing.sm,
              left: containerMargin,
              right: containerMargin,
            },
          ]}
        >
          <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.searchGlass} />
          <View style={styles.searchInner}>
            <Search color={colors.primary} size={22} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Find family, friends, or places..."
              placeholderTextColor={colors.outline}
              style={styles.searchInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voice search"
              onPress={() => {
                console.log('mic');
              }}
              style={({ pressed }) => [styles.micBtn, pressed && styles.pressed]}
            >
              <Mic color={colors.onPrimaryContainer} size={18} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

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
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollInner}
            showsVerticalScrollIndicator={false}
          >
            {sheetPeopleSorted.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => {
                  console.log('person', person.id);
                }}
                style={({ pressed }) => [
                  styles.personRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.personAvatar}>
                  <Text style={styles.personInitial}>{person.initial}</Text>
                  <View style={styles.personBadge}>
                    {person.status === 'walk' ? (
                      <Footprints color={colors.primary} size={14} strokeWidth={2} />
                    ) : (
                      <Heart color={colors.secondary} size={14} strokeWidth={2} />
                    )}
                  </View>
                </View>
                <View style={styles.personMain}>
                  <View style={styles.personTop}>
                    <View style={styles.personNameCell}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {person.name}
                      </Text>
                    </View>
                    <View style={styles.batteryPill}>
                      <Text style={styles.batteryText}>{person.battery}</Text>
                    </View>
                  </View>
                  <Text style={styles.personSub} numberOfLines={1}>
                    {person.subtitle}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      <AppDock />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
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
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    zIndex: 30,
    maxHeight: 280,
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
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetGrab: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(201, 196, 213, 0.45)',
  },
  sheetScroll: {
    maxHeight: 220,
  },
  sheetScrollInner: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
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
  batteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  batteryText: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    color: colors.tertiary,
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
});
