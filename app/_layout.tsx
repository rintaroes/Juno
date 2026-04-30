import '../lib/backgroundLocationTask';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorState } from '../components/AppErrorState';
import { AppLoading } from '../components/AppLoading';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { ONBOARDING_COMPLETION_KEY } from '../stores/onboardingStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Fraunces_400Regular,
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, loading, error, clearError } = useAuth();
  const segments = useSegments();
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const inAuthGroup = segments[0] === 'auth';
  const inOnboardingGroup = segments[0] === '(onboarding)';

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(ONBOARDING_COMPLETION_KEY)
      .then((value) => {
        if (!active) return;
        setOnboardingCompleted(value === 'true');
      })
      .catch(() => {
        if (!active) return;
        setOnboardingCompleted(false);
      })
      .finally(() => {
        if (!active) return;
        setOnboardingReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !onboardingReady) {
    return <AppLoading />;
  }

  if (error) {
    return <AppErrorState message={error} onRetry={clearError} />;
  }

  if (!session && !onboardingCompleted && !inOnboardingGroup && !inAuthGroup) {
    return <Redirect href="/(onboarding)/characters/welcome" />;
  }

  if (!session && !onboardingCompleted && inOnboardingGroup) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      />
    );
  }

  if (!session && !inAuthGroup) {
    return <Redirect href="/auth" />;
  }

  if (session && inAuthGroup) {
    return <Redirect href="/map" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    />
  );
}
