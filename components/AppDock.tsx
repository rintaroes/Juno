import {
  BookUser,
  MapPinned,
  Shield,
  UsersRound,
} from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  colors,
  dockPaddingBottom,
  dockPaddingTop,
  fontFamily,
  spacing,
  typeScale,
} from '../theme';
import { radii } from '../theme/radii';

export type DockTabId = 'protect' | 'roster' | 'map' | 'circles';

const TABS: {
  id: DockTabId;
  label: string;
  href: '/' | '/roster' | '/map' | '/circles';
  icon: typeof Shield;
}[] = [
  { id: 'protect', label: 'Protect', href: '/', icon: Shield },
  { id: 'roster', label: 'Roster', href: '/roster', icon: BookUser },
  { id: 'map', label: 'Map', href: '/map', icon: MapPinned },
  { id: 'circles', label: 'Circles', href: '/circles', icon: UsersRound },
];

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
      : 'protect';
  const bottom = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.dock,
        variant === 'floating'
          ? styles.dockFloating
          : variant === 'connected'
            ? styles.dockConnected
            : styles.dockDefault,
        {
          paddingTop: dockPaddingTop,
          paddingBottom: dockPaddingBottom + bottom,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              router.replace(tab.href);
            }}
            style={({ pressed }) => [
              styles.dockItem,
              isActive && styles.dockItemActive,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              color={isActive ? colors.indigo600 : colors.slate400}
              size={22}
              strokeWidth={2}
            />
            <Text
              style={[styles.dockLabel, isActive && styles.dockLabelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
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
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: 0,
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
    bottom: spacing.md,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: 1,
    borderColor: '#f8fafc',
  },
  dockConnected: {
    left: 0,
    right: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  dockItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radii.full,
    minWidth: 0,
    flex: 1,
    maxWidth: 100,
  },
  dockItemActive: {
    backgroundColor: colors.indigo50,
  },
  dockLabel: {
    marginTop: 4,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.dockLabel,
    color: colors.slate400,
  },
  dockLabelActive: {
    color: colors.indigo600,
  },
  pressed: {
    opacity: 0.88,
  },
});
