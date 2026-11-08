import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import type { DirectoryItemSummary } from '@shared-types';
import { Button, Screen, ScreenHeader, Stack, Text, TextInputField } from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { usePreferencesStore } from '../preferences/store/preferencesStore';
import { useDirectoryTreeQuery, type IMobileDirectory as Directory } from '../directories/api/directoryQueries';
import { getCallableErrorMessage } from '../../lib/api/studyforgeApi';
import { getStorageString, hydrateAppStorage, setStorageString } from '../../lib/storage/appStorage';
import { filterTitle, flattenTree, getBreadcrumbs, getItemWebUrl, getLibraryLocationStorageKey, resolveDirectoryId, restoreLibraryDirectoryId, sortItems } from './libraryUtils';
import { useDirectoryItems, useLiveDirectoryTree } from './libraryData';

interface ILibraryScreen {
  active: boolean;
  onCapture: () => void;
}

interface ILibraryRow {
  id: string;
  title: string;
  kind: 'heading' | 'directory' | 'item';
  directory?: Directory;
  item?: DirectoryItemSummary;
}

function getOrigin(): string {
  const value: unknown = Constants.expoConfig?.extra?.NX_PUBLIC_WEB_APP_ORIGIN;
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : 'https://study-forge-202604.web.app';
}

export function LibraryScreen({ active, onCapture }: ILibraryScreen) {
  const { user } = useAuthUser();
  const userId = user?.uid;
  const router = useRouter();
  const treeQuery = useDirectoryTreeQuery();
  const treeLive = useLiveDirectoryTree(userId, active);
  const setDefaultDirectoryId = usePreferencesStore((state) => state.setDefaultDirectoryId);
  const [directoryId, setDirectoryId] = useState<string | null>(null);
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const listRef = useRef<FlatList<ILibraryRow>>(null);
  const directories = useMemo(() => flattenTree(treeQuery.data?.tree ?? []), [treeQuery.data]);
  const itemsQuery = useDirectoryItems(userId, directoryId, active);
  const breadcrumbs = useMemo(() => getBreadcrumbs(directories, directoryId), [directories, directoryId]);
  const storageKey = userId ? getLibraryLocationStorageKey(userId) : '';

  useEffect(() => {
    const frame = requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [directoryId]);

  useEffect(() => {
    let cancelled = false;
    setLoadedUser(null);
    setDirectoryId(null);
    setSearch('');
    if (!userId) return () => { cancelled = true; };
    void hydrateAppStorage([storageKey]).then(() => {
      if (!cancelled) {
        setDirectoryId(restoreLibraryDirectoryId(getStorageString(storageKey)));
        setLoadedUser(userId);
      }
    });
    return () => { cancelled = true; };
  }, [userId, storageKey]);

  useEffect(() => {
    if (!userId || loadedUser !== userId || !treeQuery.data || treeQuery.isFetching || treeQuery.error) return;
    if (directoryId && !resolveDirectoryId(directories, directoryId)) {
      setDirectoryId(null);
      setStorageString(storageKey, '');
    }
  }, [directoryId, directories, treeQuery.data, treeQuery.isFetching, treeQuery.error, userId, loadedUser, storageKey]);

  const navigate = useCallback((id: string | null) => {
    setDirectoryId(id);
    setSearch('');
    if (storageKey) setStorageString(storageKey, id ?? '');
  }, [storageKey]);

  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (directoryId) navigate(breadcrumbs[breadcrumbs.length - 1]?.parentId ?? null);
      else onCapture();
      return true;
    });
    return () => subscription.remove();
  }, [active, directoryId, breadcrumbs, navigate, onCapture]);

  const rows = useMemo(() => {
    const directoryIds = new Set(directories.map((directory) => directory.id));
    const children = directories.filter((directory) => directory.parentId === directoryId || (directoryId === null && directory.parentId !== null && !directoryIds.has(directory.parentId)))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const matchingDirs = filterTitle(children.map((directory) => ({ title: directory.name, directory })), search);
    const matchingItems = filterTitle(sortItems((itemsQuery.data ?? []).filter((item) => item.itemType !== 'subdirectory')), search);
    const docs = matchingItems.filter((item) => item.itemType === 'document');
    const artifacts = matchingItems.filter((item) => item.itemType !== 'document');
    const result: ILibraryRow[] = [];
    if (matchingDirs.length) {
      result.push({ id: 'heading-directories', title: 'Directories', kind: 'heading' });
      result.push(...matchingDirs.map(({ directory }) => ({ id: `directory-${directory.id}`, title: directory.name, directory, kind: 'directory' as const })));
    }
    if (docs.length) {
      result.push({ id: 'heading-documents', title: 'Documents', kind: 'heading' });
      result.push(...docs.map((item) => ({ id: `item-${item.id}`, title: item.title, item, kind: 'item' as const })));
    }
    if (artifacts.length) {
      result.push({ id: 'heading-artifacts', title: 'Artifacts', kind: 'heading' });
      result.push(...artifacts.map((item) => ({ id: `item-${item.id}`, title: item.title, item, kind: 'item' as const })));
    }
    return result;
  }, [directories, directoryId, itemsQuery.data, search]);

  const error = treeLive.error ?? treeQuery.error ?? (directoryId ? itemsQuery.liveError ?? itemsQuery.error : null);
  const loading = loadedUser !== userId || (treeQuery.isLoading && !treeQuery.data) || (Boolean(directoryId) && itemsQuery.isLoading && !itemsQuery.data);
  const handleRefresh = useCallback(() => {
    void treeQuery.refetch();
    treeLive.retry();
    if (directoryId) { void itemsQuery.refetch(); itemsQuery.retryLive(); }
  }, [directoryId, treeQuery.refetch, itemsQuery.refetch, treeLive.retry, itemsQuery.retryLive]);

  const openItem = (item: DirectoryItemSummary) => {
    if (item.itemType === 'document') {
      router.push({ pathname: '/document/[id]', params: { id: item.sourceId } });
      return;
    }
    const url = getItemWebUrl(getOrigin(), item);
    if (url) void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Screen className="pt-0">
      <ScreenHeader title="Library" />
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        refreshing={treeQuery.isRefetching || itemsQuery.isRefetching}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          <Stack gap="sm" className="mt-5 mb-4">
            <View className="flex-row flex-wrap items-center">
              <Pressable accessibilityRole="button" onPress={() => navigate(null)}><Text tone="primary">Library</Text></Pressable>
              {breadcrumbs.map((directory) => (
                <View key={directory.id} className="flex-row items-center">
                  <Text tone="muted"> / </Text>
                  <Pressable accessibilityRole="button" onPress={() => navigate(directory.id)}><Text tone="primary">{directory.name}</Text></Pressable>
                </View>
              ))}
            </View>
            <TextInputField value={search} onChangeText={setSearch} placeholder="Search this directory…" autoCapitalize="none" />
            {directoryId ? <Button label="Capture here" icon="photo-camera" onPress={() => { setDefaultDirectoryId(directoryId); onCapture(); }} /> : null}
            {error ? <Text tone="destructive">{getCallableErrorMessage(error)}</Text> : null}
            {error ? <Button label="Retry" variant="secondary" onPress={handleRefresh} /> : null}
            {loading ? <Text tone="muted">Loading library…</Text> : null}
          </Stack>
        }
        ListEmptyComponent={!loading && !error ? <Text tone="muted">{search.trim() ? 'No matching items in this directory.' : 'This directory is empty.'}</Text> : null}
        renderItem={({ item }) => item.kind === 'heading' ? (
          <Text className="font-sans-semibold mt-4 mb-2">{item.title}</Text>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => item.directory ? navigate(item.directory.id) : item.item && openItem(item.item)} className="rounded-lg border border-border bg-card px-4 py-3 mb-2">
            <Text className="font-sans-semibold">{item.title}</Text>
            {item.item ? <Text tone="muted">{item.item.itemType}{item.item.generationStatus && item.item.generationStatus !== 'completed' ? ` · ${item.item.generationStatus}` : ''}</Text> : null}
          </Pressable>
        )}
      />
    </Screen>
  );
}
