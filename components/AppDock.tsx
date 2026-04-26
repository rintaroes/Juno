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
  dockShadowUp,
  fontFamily,
  typeScale,
} from '../theme';
import { radii } from '../theme/radii';

export type DockTabId = 'protect' | 'roster' | 'map' | 'circles';

const TABS: {
  id: DockTabId;
  label: string;
  href: '/' | '/roster' | '/map' | null;
  icon: typeof Shield;
}[] = [
  { id: 'protect', label: 'Protect', href: '/', icon: Shield },
  { id: 'roster', label: 'Roster', href: '/roster', icon: BookUser },
  { id: 'map', label: 'Map', href: '/map', icon: MapPinned },
  { id: 'circles', label: 'Circles', href: null, icon: UsersRound },
];

export function AppDock() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const active: DockTabId = pathname.startsWith('/roster')
    ? 'roster'
    : pathname.includes('/map')
      ? 'map'
      : 'protect';
  const bottom = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.dock,
        dockShadowUp,
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
              if (tab.href) {
                router.replace(tab.href);
                return;
              }
              console.log('dock', tab.id);
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
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    borderTopLeftRadius: radii.dockTop,
    borderTopRightRadius: radii.dockTop,
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
