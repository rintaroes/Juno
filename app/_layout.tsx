import '../lib/backgroundLocationTask';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold,
  Newsreader_600SemiBold_Italic,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorState } from '../components/AppErrorState';
import { AppLoading } from '../components/AppLoading';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { ONBOARDING_COMPLETION_KEY } from '../stores/onboardingStore';

void SplashScreen.preventAutoHideAsync().catch(() => {
  /* Dev client / web or repeat calls — safe to ignore. */
});

export default function RootLayout() {
  const splashHiddenRef = useRef(false);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_500Medium_Italic,
    Newsreader_600SemiBold,
    Newsreader_600SemiBold_Italic,
    Newsreader_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    void SplashScreen.hideAsync().catch(() => {
      /* Already hidden, Strict Mode second pass, or no native splash (some dev setups). */
    });
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
