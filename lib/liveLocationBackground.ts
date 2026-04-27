import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { BACKGROUND_LOCATION_TASK } from './backgroundLocationTask';

/**
 * Starts OS background location updates (requires always/background permission + persisted auth session).
 * Idempotent.
 */
export async function startLiveLocationBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 75,
    timeInterval: 45_000,
    deferredUpdatesInterval: 120_000,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: true,
    foregroundService: {
      notificationTitle: 'Juno — location sharing',
      notificationBody: 'Sharing your location with your circle (always-on)',
      notificationColor: '#5f4bbe',
    },
  });
}

export async function stopLiveLocationBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))) return;
  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}
