import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permission (if needed), registers the Expo push token with Supabase.
 * No-op on web. Safe to call repeatedly (upserts by user + token).
 */
export async function registerExpoPushTokenForSignedInUser(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId?.trim()) {
      console.warn(
        '[juno] Push: no EAS projectId in app config (extra.eas.projectId). Run `npx eas-cli init` and set EXPO_PUBLIC_EAS_PROJECT_ID in .env, or add projectId to app config. Skipping token registration.',
      );
      return;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({
      projectId: String(projectId).trim(),
    });
    const expoPushToken = tokenRes.data;

    const { error } = await getSupabase().functions.invoke('register-push-token', {
      body: {
        expo_push_token: expoPushToken,
        platform: Platform.OS,
      },
    });
    if (error) {
      console.warn('[juno] register-push-token', error.message);
    }
  } catch (e) {
    console.warn('[juno] registerExpoPushTokenForSignedInUser', e instanceof Error ? e.message : e);
  }
}
