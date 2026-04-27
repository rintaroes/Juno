import type { LocationObject } from 'expo-location';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { updateMyLiveLocation } from './dateMode';

/** Registered with Location.startLocationUpdatesAsync — must be imported once at app entry (see app/_layout.tsx). */
export const BACKGROUND_LOCATION_TASK = 'juno-live-location-background';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[juno] background location task', error);
    return;
  }
  const locations = (data as { locations?: LocationObject[] })?.locations;
  if (!locations?.length) return;
  const loc = locations[locations.length - 1];
  const { latitude, longitude } = loc.coords;
  const acc = loc.coords.accuracy ?? null;
  try {
    await updateMyLiveLocation(latitude, longitude, acc);
  } catch (e) {
    console.warn('[juno] background location sync', e);
  }
});
