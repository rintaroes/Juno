import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DockCirclesIcon,
  DockMapIcon,
  DockProtectIcon,
  DockRosterIcon,
} from './dock/DockIcons';
import {
  colors,
  dockPaddingTop,
  dockTabBlockHeight,
  fontFamily,
  spacing,
  typeScale,
} from '../theme';
import { radii } from '../theme/radii';

export type DockTabId = 'protect' | 'roster' | 'map' | 'circles';

const ACTIVE = colors.cta;
const INACTIVE = colors.meta;

type TabConfig = {
  id: DockTabId;
  label: string;
  href: '/map' | '/protect' | '/roster' | '/circles';
  Icon: typeof DockMapIcon;
};

const TABS: TabConfig[] = [
  { id: 'map', label: 'Map', href: '/map', Icon: DockMapIcon },
  { id: 'protect', label: 'Protect', href: '/protect', Icon: DockProtectIcon },
  { id: 'roster', label: 'Roster', href: '/roster', Icon: DockRosterIcon },
  { id: 'circles', label: 'Circles', href: '/circles', Icon: DockCirclesIcon },
];

const ICON_SIZE = 24;
const INDICATOR_WIDTH = 28;
const INDICATOR_HEIGHT = 3;

export function AppDock({
  variant = 'default',
}: {
  variant?: 'default' | 'floating' | 'connected';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const active: DockTabId = pathname.startsWith('/roster')
    ? 'roster'
    : pathname.includes('/map')
      ? 'map'
      : pathname.includes('/circles')
        ? 'circles'
        : pathname.includes('/protect') || pathname.startsWith('/registry')
          ? 'protect'
          : 'protect';

  const isFloating = variant === 'floating';
  const bottomInset = isFloating ? insets.bottom + spacing.sm : insets.bottom;

  return (
    <View
      style={[
        styles.dock,
        isFloating ? styles.dockFloating : styles.dockDefault,
        {
          paddingTop: dockPaddingTop,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const tint = isActive ? ACTIVE : INACTIVE;
        const strokeWidth = isActive ? 2.25 : 2;
        const { Icon } = tab;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              router.replace(tab.href);
            }}
            style={({ pressed }) => [styles.dockItem, pressed && styles.pressed]}
          >
            <Icon color={tint} size={ICON_SIZE} strokeWidth={strokeWidth} />
            <Text
              style={[styles.dockLabel, isActive && styles.dockLabelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            <View style={styles.indicatorSlot}>
              {isActive ? <View style={styles.indicator} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    zIndex: 220,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ghostBorder,
  },
  dockDefault: {
    left: 0,
    right: 0,
    borderTopLeftRadius: radii.dockTop,
    borderTopRightRadius: radii.dockTop,
  },
  dockFloating: {
    left: spacing.sm,
    right: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    borderTopWidth: 1,
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: dockTabBlockHeight,
    paddingHorizontal: 6,
    minWidth: 0,
    flex: 1,
  },
  dockLabel: {
    marginTop: 6,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.dockLabel,
    color: INACTIVE,
  },
  dockLabelActive: {
    fontFamily: fontFamily.semiBold,
    color: ACTIVE,
  },
  indicatorSlot: {
    height: INDICATOR_HEIGHT + 4,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  indicator: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: ACTIVE,
  },
  pressed: {
    opacity: 0.88,
  },
});
