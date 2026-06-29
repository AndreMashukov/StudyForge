import { useCallback, useEffect, useMemo } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  HeaderIconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  Stack,
  Text,
} from '@studyforge/mobile-ui';
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
    <Screen className="pt-0">
      <ScreenHeader
        title="Scan to StudyForge"
        trailing={
          <HeaderIconButton
            icon="settings"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
          />
        }
      />

      <Card className="mt-6 mb-5 gap-3">
        <Text variant="label" tone="muted">
          Pipeline
        </Text>
        <Text>Document scanner → on-device OCR → review → upload</Text>
      </Card>

      <Stack gap="xs" className="mb-5">
        <Text variant="label" tone="muted">
          Status
        </Text>
        <Text>{stateLabel(captureState)}</Text>

        <Text variant="label" tone="muted" className="mt-3 mb-2">
          Default directory
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens directory picker in Settings"
          onPress={() => router.push('/settings')}
          className="rounded-lg border border-border bg-card px-3.5 py-3.5 min-h-12 mb-2"
        >
          {defaultDirectory ? (
            <Stack gap="xs">
              <Text className="font-sans-semibold">{defaultDirectory.name}</Text>
              <Text tone="muted">{defaultDirectory.path}</Text>
              <Text tone="primary">Tap to change directory</Text>
            </Stack>
          ) : (
            <Stack gap="xs">
              <Text className="font-sans-semibold">Not selected</Text>
              <Text tone="primary">Tap to choose a directory</Text>
            </Stack>
          )}
        </Pressable>

        {data && !error ? (
          <Text tone="muted">
            {directoryCount} director{directoryCount === 1 ? 'y' : 'ies'} in your library
          </Text>
        ) : null}
        {error ? <Text tone="destructive">{getCallableErrorMessage(error)}</Text> : null}
        {statusMessage ? <Text className="mt-2">{statusMessage}</Text> : null}
        {lastDocumentId ? (
          <Text tone="accent" className="mt-2">
            Latest document: {lastTitle} ({lastDocumentId})
          </Text>
        ) : null}
      </Stack>

      <Stack gap="sm">
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
      </Stack>
    </Screen>
  );
}
