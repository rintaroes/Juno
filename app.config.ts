import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { expo } = require('./app.json') as { expo: ExpoConfig };

export default (): ExpoConfig => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  const easProjectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ?? 'c3a1e8ce-3fe0-4fcb-965b-02fa05741ec6';
  const baseAndroid = expo.android ?? {};
  const existingExtra =
    expo.extra && typeof expo.extra === 'object' ? (expo.extra as Record<string, unknown>) : {};
  const existingEas =
    existingExtra.eas && typeof existingExtra.eas === 'object'
      ? (existingExtra.eas as Record<string, unknown>)
      : {};

  return {
    ...expo,
    owner: 'anderiso1s-organization',
    extra: {
      ...existingExtra,
      eas: {
        ...existingEas,
        ...(easProjectId ? { projectId: easProjectId } : {}),
      },
    },
    android: {
      ...baseAndroid,
      config: {
        ...(baseAndroid as { config?: Record<string, unknown> }).config,
        ...(mapsKey ? { googleMaps: { apiKey: mapsKey } } : {}),
      },
    },
  };
};
