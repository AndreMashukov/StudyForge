import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Heading,
  LoadingState,
  Stack,
  Text,
  TextInputField,
} from '@studyforge/mobile-ui';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import {
  filterDirectories,
  flattenDirectoryTree,
  IMobileDirectory,
  useDirectoryTreeQuery,
} from '../api/directoryQueries';
import { getCallableErrorMessage } from '../../../lib/api/studyforgeApi';
import { usePreferencesStore } from '../../preferences/store/preferencesStore';
import { useAuthUser } from '../../auth/hooks/useAuthUser';

const SEARCH_DEBOUNCE_MS = 300;

export function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthUser();
  const { data, isLoading, error, refetch } = useDirectoryTreeQuery();
  const defaultDirectoryId = usePreferencesStore((state) => state.defaultDirectoryId);
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  const setDefaultDirectoryId = usePreferencesStore((state) => state.setDefaultDirectoryId);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    void hydratePreferences();
  }, [hydratePreferences]);

  const directories = data ? flattenDirectoryTree(data.tree) : [];
  const filteredDirectories = useMemo(
    () => filterDirectories(directories, debouncedSearchQuery),
    [directories, debouncedSearchQuery]
  );

  if (isLoading) {
    return <LoadingState message="Loading directories…" />;
  }

  const hasSearchQuery = debouncedSearchQuery.trim().length > 0;

  return (
    <FlatList
      data={filteredDirectories}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-background px-5 pt-4"
      ListHeaderComponent={
        <Stack gap="xs" className="mb-5">
          <Heading level={1}>Settings</Heading>
          <Text tone="muted">Signed in as {user?.email ?? 'unknown user'}</Text>
          <Text className="font-semibold mt-4 mb-2">Default capture directory</Text>
          <TextInputField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or path…"
            autoCapitalize="none"
            className="mb-3"
          />
          {directories.length > 0 ? (
            <Text tone="muted" className="mb-2">
              {hasSearchQuery
                ? `${filteredDirectories.length} of ${directories.length} directories`
                : `${directories.length} directories`}
            </Text>
          ) : null}
          {error ? <Text tone="destructive" className="mb-3">{getCallableErrorMessage(error)}</Text> : null}
        </Stack>
      }
      ListEmptyComponent={
        <Text tone="muted">
          {hasSearchQuery
            ? `No directories match "${debouncedSearchQuery.trim()}".`
            : 'No directories found. Create one in the web app first.'}
        </Text>
      }
      renderItem={({ item }) => (
        <DirectoryRow
          directory={item}
          selected={item.id === defaultDirectoryId}
          onSelect={() => setDefaultDirectoryId(item.id)}
        />
      )}
      ItemSeparatorComponent={() => <View className="h-2" />}
      ListFooterComponent={
        <Stack gap="sm" className="mt-5 pb-8">
          <Button label="Refresh" variant="secondary" onPress={() => void refetch()} />
          <Button label="Back to capture" onPress={() => router.back()} />
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        </Stack>
      }
    />
  );
}

function DirectoryRow({
  directory,
  selected,
  onSelect,
}: {
  directory: IMobileDirectory;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onSelect}
      className={`rounded-xl border px-3.5 py-3.5 ${selected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
    >
      <Text className="font-semibold">{directory.name}</Text>
      <Text tone="muted" className="mt-1">
        {directory.path}
      </Text>
    </Pressable>
  );
}
