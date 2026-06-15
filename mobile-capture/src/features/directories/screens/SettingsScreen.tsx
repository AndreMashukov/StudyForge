import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Directory } from '@shared-types';
import { Button, LoadingState, TextInputField } from '../../../components/ui/primitives';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import {
  filterDirectories,
  flattenDirectoryTree,
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
        <View className="mb-5 gap-1">
          <Text className="text-foreground text-3xl font-bold">Settings</Text>
          <Text className="text-muted-foreground text-base">
            Signed in as {user?.email ?? 'unknown user'}
          </Text>
          <Text className="text-foreground text-base font-semibold mt-4 mb-2">
            Default capture directory
          </Text>
          <TextInputField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or path…"
            autoCapitalize="none"
            className="mb-3"
          />
          {directories.length > 0 ? (
            <Text className="text-muted-foreground text-sm mb-2">
              {hasSearchQuery
                ? `${filteredDirectories.length} of ${directories.length} directories`
                : `${directories.length} directories`}
            </Text>
          ) : null}
          {error ? (
            <Text className="text-destructive text-sm mb-3">
              {getCallableErrorMessage(error)}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <Text className="text-muted-foreground text-base">
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
        <View className="gap-2.5 mt-5 pb-8">
          <Button label="Refresh" variant="secondary" onPress={() => void refetch()} />
          <Button label="Back to capture" onPress={() => router.back()} />
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        </View>
      }
    />
  );
}

function DirectoryRow({
  directory,
  selected,
  onSelect,
}: {
  directory: Directory;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onSelect}
      className={`rounded-xl border px-3.5 py-3.5 ${selected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
    >
      <Text className="text-foreground text-base font-semibold">{directory.name}</Text>
      <Text className="text-muted-foreground text-sm mt-1">{directory.path}</Text>
    </Pressable>
  );
}
