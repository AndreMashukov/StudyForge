import '../../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingState, mobileUiColors } from '@studyforge/mobile-ui';
import { useAuthUser } from '../features/auth/hooks/useAuthUser';
import { queryClient } from '../lib/api/queryClient';
import { usePreferencesStore } from '../features/preferences/store/preferencesStore';
import { useCaptureStore } from '../features/capture/store/captureStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuthUser();
  const segments = useSegments();
  const router = useRouter();
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (initializing) return;
    if (previousUserId.current && previousUserId.current !== user?.uid) {
      queryClient.clear();
      useCaptureStore.setState({
        captureState: 'idle',
        statusMessage: null,
        pendingScan: null,
        lastDocumentId: null,
        lastTitle: null,
      });
      usePreferencesStore.setState({
        defaultDirectoryId: null,
        hydrated: false,
      });
    }
    previousUserId.current = user?.uid ?? null;
  }, [initializing, user?.uid]);

  useEffect(() => {
    void hydratePreferences();
  }, [hydratePreferences]);

  useEffect(() => {
    if (initializing) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, initializing, segments, router]);

  if (initializing) {
    return <LoadingState message="Loading StudyForge…" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: mobileUiColors.background },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="library" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="document/[id]" />
              <Stack.Screen
                name="scan/review"
                options={{
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.5, 1],
                }}
              />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
