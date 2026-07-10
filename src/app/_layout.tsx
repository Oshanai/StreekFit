import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';
import { useFonts } from 'expo-font';
import { useURL } from 'expo-linking';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { createSessionFromUrl } from '@/features/auth/oauth';
import { supabase } from '@/lib/supabase/client';
import { initI18n } from '@/i18n';
import { LanguageTransitionProvider } from '@/i18n/LanguageTransition';
import { LoadingState, ThemeProvider, palette } from '@/shared/ui';

SplashScreen.preventAutoHideAsync();

// RN has no background token refresh — tie it to foreground state (official pattern),
// otherwise sessions silently expire after ~1h in background.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

function RootNavigator() {
  const { session, loading, onboardingComplete } = useAuth();

  // Auth deep links (magic link, OAuth redirect) can arrive outside the auth
  // screen: cold start, Android 'dismiss' case. Harmless no-op for other URLs.
  const incomingUrl = useURL();
  useEffect(() => {
    if (incomingUrl) createSessionFromUrl(incomingUrl).catch(() => {});
  }, [incomingUrl]);

  if (loading) return <LoadingState />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && onboardingComplete}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !onboardingComplete}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="auth" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  const ready = fontsLoaded && i18nReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: palette.dark.bg,
          card: palette.dark.surface,
          primary: palette.dark.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: palette.light.bg,
          card: palette.light.surface,
          primary: palette.light.primary,
        },
      };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavThemeProvider value={navTheme}>
            <AuthProvider>
              <LanguageTransitionProvider>
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <RootNavigator />
              </LanguageTransitionProvider>
            </AuthProvider>
          </NavThemeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
