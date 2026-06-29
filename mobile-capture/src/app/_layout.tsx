import '../../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { LoadingState } from '@studyforge/mobile-ui';
import { useAuthUser } from '../features/auth/hooks/useAuthUser';
import { queryClient } from '../lib/api/queryClient';
import { usePreferencesStore } from '../features/preferences/store/preferencesStore';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuthUser();
  const segments = useSegments();
  const router = useRouter();
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="settings" />
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
  );
}
