import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Bell, MapPin, UserCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function PermissionsScreen() {
  const router = useRouter();
  const permissions = useOnboardingStore((state) => state.permissions);
  const setPermission = useOnboardingStore((state) => state.setPermission);
  useOnboardingStep(14, 'permissions');

  const request = async (key: 'location' | 'notifications' | 'contacts') => {
    if (key === 'location') {
      const result = await Location.requestForegroundPermissionsAsync();
      setPermission('location', result.status === 'granted');
      if (result.status === 'granted') void trackOnboardingEvent('onboarding_permission_granted', { key });
      return;
    }
    if (key === 'notifications') {
      const result = await Notifications.requestPermissionsAsync();
      setPermission('notifications', result.status === 'granted');
      if (result.status === 'granted') void trackOnboardingEvent('onboarding_permission_granted', { key });
      return;
    }
    const result = await Contacts.requestPermissionsAsync();
    setPermission('contacts', result.status === 'granted');
    if (result.status === 'granted') void trackOnboardingEvent('onboarding_permission_granted', { key });
  };

  return (
    <OnboardingScreen step={14}>
      <View style={styles.main}>
        <OnboardingHeader>A few quick yeses.</OnboardingHeader>
        <Text style={styles.sub}>Each of these makes Juno work the way it&apos;s supposed to.</Text>
        <PermissionCard
          icon={<MapPin color={colors.stone} size={20} />}
          title="Share your location with your circle"
          body="So your friends can see you're safe - only when you choose to share."
          allowed={permissions.location}
          onPress={() => void request('location')}
        />
        <PermissionCard
          icon={<Bell color={colors.stone} size={20} />}
          title="Get pinged about your circle"
          body="Date check-ins, safety alerts, tea packages."
          allowed={permissions.notifications}
          onPress={() => void request('notifications')}
        />
        <PermissionCard
          icon={<UserCircle color={colors.stone} size={20} />}
          title="Find friends already on Juno"
          body="We'll never message your contacts without you."
          allowed={permissions.contacts}
          onPress={() => void request('contacts')}
        />
      </View>
      <OnboardingButton label="Continue" onPress={() => router.push('/(onboarding)/characters/first-check')} />
    </OnboardingScreen>
  );
}

function PermissionCard({
  icon,
  title,
  body,
  allowed,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  allowed: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      <Pressable style={[styles.allowBtn, allowed && styles.allowed]} onPress={onPress}>
        <Text style={styles.allowText}>{allowed ? 'Allowed' : 'Allow'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 12 },
  sub: { fontFamily: fontFamily.inter, fontSize: 14, color: colors.stone },
  card: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.stone,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  iconWrap: { width: 22 },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontFamily: fontFamily.interMedium, fontSize: 14, color: colors.charcoal },
  cardBody: { fontFamily: fontFamily.inter, fontSize: 12, color: colors.stone, lineHeight: 17 },
  allowBtn: { backgroundColor: colors.coral, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  allowed: { backgroundColor: colors.sienna },
  allowText: { color: colors.cream, fontFamily: fontFamily.interMedium, fontSize: 12 },
});
