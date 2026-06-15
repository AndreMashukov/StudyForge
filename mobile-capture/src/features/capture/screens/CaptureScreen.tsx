import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, LoadingState, Screen } from '../../../components/ui/primitives';
import { CaptureScanCommandHandler } from '../services/CaptureScanCommandHandler';
import { CaptureState } from '../types/ICapture';
import { useCaptureStore } from '../store/captureStore';
import { usePreferencesStore } from '../../preferences/store/preferencesStore';
import { useAuthUser } from '../../auth/hooks/useAuthUser';
import { flattenDirectoryTree, useDirectoryTreeQuery } from '../../directories/api/directoryQueries';
import { getCallableErrorMessage } from '../../../lib/api/studyforgeApi';

function stateLabel(state: CaptureState): string {
  switch (state) {
    case 'validating':
      return 'Validating settings…';
    case 'capturing':
      return 'Opening document scanner…';
    case 'ocr':
      return 'Running on-device OCR…';
    case 'uploading':
      return 'Sending to StudyForge…';
    case 'success':
      return 'Scan complete';
    case 'error':
      return 'Capture failed';
    default:
      return 'Ready';
  }
}

export function CaptureScreen() {
  const router = useRouter();
  const { signOut } = useAuthUser();
  const { data, isLoading, error, refetch, isRefetching } = useDirectoryTreeQuery();
  const defaultDirectoryId = usePreferencesStore((state) => state.defaultDirectoryId);
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  const {
    captureState,
    statusMessage,
    lastDocumentId,
    lastTitle,
    setCaptureState,
    setStatusMessage,
    setPendingScan,
    resetStatus,
  } = useCaptureStore();

  const handler = useMemo(() => new CaptureScanCommandHandler(), []);

  useEffect(() => {
    void hydratePreferences();
  }, [hydratePreferences]);

  useEffect(() => {
    handler.setOnStateChange(setCaptureState);
  }, [handler, setCaptureState]);

  const directoryCount = data ? flattenDirectoryTree(data.tree).length : 0;

  const handleRefreshDirectories = useCallback(async () => {
    setStatusMessage('Refreshing directories…');
    const result = await refetch();
    if (result.error) {
      setStatusMessage(getCallableErrorMessage(result.error));
      return;
    }
    const count = result.data ? flattenDirectoryTree(result.data.tree).length : 0;
    if (count === 0) {
      setStatusMessage('No directories found. Create one in the web app, then pick it in Settings.');
      return;
    }
    if (defaultDirectoryId) {
      setStatusMessage(`Loaded ${count} director${count === 1 ? 'y' : 'ies'}.`);
      return;
    }
    setStatusMessage(`Loaded ${count} director${count === 1 ? 'y' : 'ies'}. Open Settings to choose one.`);
  }, [defaultDirectoryId, refetch, setStatusMessage]);

  const defaultDirectory = data?.tree && defaultDirectoryId
    ? flattenDirectoryTree(data.tree).find((directory) => directory.id === defaultDirectoryId) ?? null
    : null;

  const handleScan = useCallback(async () => {
    if (!defaultDirectoryId) {
      setStatusMessage('Choose a default directory in Settings before scanning.');
      return;
    }

    resetStatus();

    try {
      const result = await handler.handle(defaultDirectoryId);
      setPendingScan({
        imageUri: result.imageUri,
        ocrText: result.ocrText,
        directoryId: defaultDirectoryId,
      });
      router.push('/scan/review');
    } catch (scanError) {
      setStatusMessage(scanError instanceof Error ? scanError.message : 'Scan failed.');
    }
  }, [defaultDirectoryId, handler, resetStatus, router, setPendingScan, setStatusMessage]);

  if (isLoading) {
    return <LoadingState message="Loading capture settings…" />;
  }

  return (
    <Screen className="pt-4">
      <View className="flex-row justify-between items-start mb-6 gap-3">
        <View className="flex-1">
          <Text className="text-primary text-xs font-bold uppercase">StudyForge Capture</Text>
          <Text className="text-foreground text-2xl font-bold mt-1">Scan to StudyForge</Text>
        </View>
        <Button label="Settings" variant="secondary" onPress={() => router.push('/settings')} />
      </View>

      <View className="rounded-2xl border border-border bg-card p-5 mb-5 gap-3">
        <Text className="text-muted-foreground text-xs uppercase tracking-wider">Pipeline</Text>
        <Text className="text-foreground text-base">
          Document scanner → on-device OCR → review → upload
        </Text>
      </View>

      <View className="gap-1 mb-5">
        <Text className="text-muted-foreground text-xs uppercase tracking-wider">Status</Text>
        <Text className="text-foreground text-base">{stateLabel(captureState)}</Text>

        <Text className="text-muted-foreground text-xs uppercase tracking-wider mt-3 mb-2">
          Default directory
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens directory picker in Settings"
          onPress={() => router.push('/settings')}
          className="rounded-xl border border-border bg-card px-3.5 py-3.5 mb-2"
        >
          {defaultDirectory ? (
            <>
              <Text className="text-foreground text-base font-semibold">{defaultDirectory.name}</Text>
              <Text className="text-muted-foreground text-sm mt-1">{defaultDirectory.path}</Text>
              <Text className="text-primary text-sm mt-2">Tap to change directory</Text>
            </>
          ) : (
            <>
              <Text className="text-foreground text-base font-semibold">Not selected</Text>
              <Text className="text-primary text-sm mt-2">Tap to choose a directory</Text>
            </>
          )}
        </Pressable>

        {data && !error ? (
          <Text className="text-muted-foreground text-sm">
            {directoryCount} director{directoryCount === 1 ? 'y' : 'ies'} in your library
          </Text>
        ) : null}
        {error ? (
          <Text className="text-destructive text-sm mt-2">
            {getCallableErrorMessage(error)}
          </Text>
        ) : null}
        {statusMessage ? <Text className="text-foreground text-sm mt-2">{statusMessage}</Text> : null}
        {lastDocumentId ? (
          <Text className="text-accent text-sm mt-2">
            Latest document: {lastTitle} ({lastDocumentId})
          </Text>
        ) : null}
      </View>

      <View className="gap-2.5">
        <Button
          label={defaultDirectory ? 'Change directory' : 'Choose directory'}
          variant="secondary"
          onPress={() => router.push('/settings')}
        />
        <Button
          label={captureState === 'idle' ? 'Scan document' : stateLabel(captureState)}
          disabled={captureState !== 'idle' || !defaultDirectoryId}
          onPress={() => void handleScan()}
        />
        <Button
          label={isRefetching ? 'Refreshing…' : 'Refresh directories'}
          variant="secondary"
          disabled={isRefetching}
          onPress={() => void handleRefreshDirectories()}
        />
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}
