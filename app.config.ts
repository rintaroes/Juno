import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { expo } = require('./app.json') as { expo: ExpoConfig };

export default (): ExpoConfig => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const baseAndroid = expo.android ?? {};
  return {
    ...expo,
    android: {
      ...baseAndroid,
      config: {
        ...(baseAndroid as { config?: Record<string, unknown> }).config,
        ...(mapsKey ? { googleMaps: { apiKey: mapsKey } } : {}),
      },
    },
  };
};
