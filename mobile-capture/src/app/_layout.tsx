import '../../global.css';
import '../lib/clientData';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
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
import {
  QUERY_CACHE_MAX_AGE_MS,
  hydrateQueryCacheStorage,
  queryPersister,
  shouldPersistQuery,
} from '../lib/api/queryPersistence';
import { wireOnlineManager } from '../lib/network/online';
import { hydrateRecentlyOpened } from '../lib/storage/recentlyOpened';
import { startTelemetryOutbox } from '../features/study/telemetry';
import { usePreferencesStore } from '../features/preferences/store/preferencesStore';
import { useCaptureStore } from '../features/capture/store/captureStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
wireOnlineManager();

/** Bump to discard persisted query caches after a breaking change to cached shapes. */
const QUERY_CACHE_BUSTER = 'study-app-1';

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

  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    // MMKV is synchronous; the AsyncStorage fallback needs these keys loaded before first render.
    void Promise.all([hydrateQueryCacheStorage(), hydrateRecentlyOpened()])
      .catch(() => undefined)
      .finally(() => setStorageReady(true));
    void startTelemetryOutbox();
  }, []);

  useEffect(() => {
    if (fontsLoaded && storageReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, storageReady]);

  if (!fontsLoaded || !storageReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: QUERY_CACHE_MAX_AGE_MS,
            buster: QUERY_CACHE_BUSTER,
            dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
          }}
        >
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: mobileUiColors.background },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen
                name="scan/review"
                options={{
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.5, 1],
                }}
              />
            </Stack>
          </AuthGate>
        </PersistQueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
