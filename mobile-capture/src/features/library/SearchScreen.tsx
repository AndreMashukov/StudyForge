import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderIconButton, Text, mobileUiColors } from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useIsOnline } from '../../lib/network/online';
import { openLibraryItem } from '../assistant/ChatMessageView';
import { startChat } from '../assistant/chatNavigation';
import { ItemRow, OfflineBanner, SectionLabel } from '../shell/ui';
import { itemIcon, itemKindLabel } from './itemNavigation';
import { useLibraryIndex } from './libraryIndex';
import { searchLibrary, type ISearchHit } from './librarySearch';
import { statusBadge } from './libraryRows';

/** Title search across the whole library, on device (decision 5). Content questions go to the assistant. */
export function SearchScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const { user } = useAuthUser();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 120);
  const { index, isLoading } = useLibraryIndex(user?.uid);
  const results = useMemo(
    () => searchLibrary(index, debounced),
    [index, debounced],
  );
  const total =
    results.directories.length +
    results.documents.length +
    results.artifacts.length;

  const row = (hit: ISearchHit) => (
    <ItemRow
      key={`${hit.itemType}:${hit.id}`}
      icon={itemIcon(hit.itemType)}
      title={hit.title}
      subtitle={[itemKindLabel(hit.itemType), hit.path]
        .filter(Boolean)
        .join(' · ')}
      badge={statusBadge(hit.generationStatus)}
      onPress={() => openLibraryItem(router, hit)}
    />
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 px-container pb-2 pt-1">
        <HeaderIconButton
          icon="arrow-back"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        />
        <View className="h-11 flex-1 flex-row items-center gap-2 rounded-2xl bg-card px-3">
          <MaterialIcons
            name="search"
            size={20}
            color={mobileUiColors.placeholder}
          />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search your library"
            placeholderTextColor={mobileUiColors.placeholder}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search your library"
            className="flex-1 font-sans text-base text-foreground"
          />
        </View>
      </View>
      <OfflineBanner />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      >
        {debounced.trim() ? (
          <Pressable
            accessibilityRole="button"
            disabled={!online}
            onPress={() => startChat(router, { message: debounced.trim() })}
            className="mt-1 flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3"
            style={{ opacity: online ? 1 : 0.5 }}
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
              <MaterialIcons
                name="auto-awesome"
                size={18}
                color={mobileUiColors.primaryForeground}
              />
            </View>
            <View className="flex-1">
              <Text className="font-sans-medium">Ask StudyForge</Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                “{debounced.trim()}”
              </Text>
            </View>
          </Pressable>
        ) : null}
        {results.documents.length ? (
          <>
            <SectionLabel>Documents</SectionLabel>
            {results.documents.map(row)}
          </>
        ) : null}
        {results.artifacts.length ? (
          <>
            <SectionLabel>Artifacts</SectionLabel>
            {results.artifacts.map(row)}
          </>
        ) : null}
        {results.directories.length ? (
          <>
            <SectionLabel>Directories</SectionLabel>
            {results.directories.map(row)}
          </>
        ) : null}
        {debounced.trim() && !total && !isLoading ? (
          <Text tone="muted" className="mt-6 text-center">
            No titles match. Ask StudyForge to search inside your documents.
          </Text>
        ) : null}
        {!debounced.trim() ? (
          <Text tone="muted" className="mt-6 text-center">
            Search titles of directories, documents and artifacts.
          </Text>
        ) : null}
        {isLoading && debounced.trim() ? (
          <Text tone="muted" className="mt-4">
            Indexing your library…
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
