import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  ILibrarySearchHit,
  ISearchSnippetSegment,
} from '@studyforge/client-data/librarySearch/searchTypes';
import { HeaderIconButton, Text, mobileUiColors } from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useIsOnline } from '../../lib/network/online';
import { openLibraryItem } from '../assistant/ChatMessageView';
import { startChat } from '../assistant/chatNavigation';
import { ItemRow, OfflineBanner, SectionLabel } from '../shell/ui';
import { itemIcon, itemKindLabel } from './itemNavigation';
import {
  syncLibrarySearch,
  useLibrarySearchClient,
} from './librarySearchClient';
import { statusBadge } from './libraryRows';

export interface ISearchScreen {
  /** Set when search was opened from a directory: results start narrowed to it. */
  directoryId?: string;
}

function Snippet({ segments }: { segments: ISearchSnippetSegment[] }) {
  return (
    <Text
      variant="caption"
      tone="muted"
      numberOfLines={2}
      className="-mt-1.5 mb-1.5 pl-12"
    >
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <Text
            key={index}
            variant="caption"
            className="font-sans-medium text-foreground"
          >
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </Text>
  );
}

function SearchResults({ userId, directoryId }: ISearchScreen & { userId: string }) {
  const router = useRouter();
  const online = useIsOnline();
  const { client, status } = useLibrarySearchClient(userId);
  const [query, setQuery] = useState('');
  const [scoped, setScoped] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const debounced = useDebouncedValue(query, 120);
  const trimmed = debounced.trim();
  const scopeId = directoryId && scoped ? directoryId : undefined;

  const results = useMemo(
    () => client.search(debounced, scopeId ? { directoryId: scopeId } : undefined),
    // status.version changes whenever the same query could return something else.
    [client, debounced, scopeId, status.version, status.ready],
  );
  const libraryTotal =
    results.directories.length +
    results.documents.length +
    results.artifacts.length;
  const total = libraryTotal + results.chats.length;
  const directoryTitle = directoryId
    ? (client.getDirectoryTitle(directoryId) ?? 'this directory')
    : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncLibrarySearch(userId);
    setRefreshing(false);
  };

  const handleOpenChat = (hit: ILibrarySearchHit) => {
    const folderTitle = hit.directoryId
      ? client.getDirectoryTitle(hit.directoryId)
      : undefined;
    router.push({
      pathname: '/chat/[threadId]',
      params: {
        threadId: hit.id,
        title: hit.title,
        ...(hit.directoryId ? { directoryId: hit.directoryId } : {}),
        ...(folderTitle ? { label: folderTitle } : {}),
      },
    });
  };

  const row = (hit: ILibrarySearchHit) => {
    const { itemType } = hit;
    const isChat = itemType === 'chat';
    return (
      <View key={`${itemType}:${hit.id}`}>
        <ItemRow
          icon={isChat ? 'chat-bubble-outline' : itemIcon(itemType)}
          title={hit.title}
          subtitle={[
            isChat ? 'Chat' : itemKindLabel(itemType),
            hit.path,
            hit.lastActivityAt !== undefined
              ? new Date(hit.lastActivityAt).toLocaleDateString()
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          badge={isChat ? undefined : statusBadge(hit.generationStatus)}
          onPress={() =>
            isChat
              ? handleOpenChat(hit)
              : openLibraryItem(router, { ...hit, itemType })
          }
        />
        {hit.snippet ? <Snippet segments={hit.snippet} /> : null}
      </View>
    );
  };

  const notice = (() => {
    if (!status.ready) return 'Preparing search…';
    if (!status.hasSynced) {
      return status.syncing
        ? 'Indexing your library…'
        : 'Search needs a connection the first time. Reconnect and pull down to retry.';
    }
    if (!trimmed) {
      return 'Search names of directories, documents and artifacts, the text of your documents, and your chats.';
    }
    if (!total) {
      return scopeId
        ? `Nothing in ${directoryTitle} matches “${trimmed}”.`
        : `Nothing matches “${trimmed}”.`;
    }
    return null;
  })();

  return (
    <>
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
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search your library"
            className="flex-1 font-sans text-base text-foreground"
          />
        </View>
      </View>
      {directoryTitle ? (
        <View className="flex-row px-container pb-2">
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: scoped }}
            accessibilityLabel={`Search only in ${directoryTitle}`}
            onPress={() => setScoped((value) => !value)}
            className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
              scoped ? 'bg-primary' : 'bg-card'
            }`}
          >
            <Text
              variant="caption"
              numberOfLines={1}
              className={scoped ? 'text-primary-foreground' : undefined}
              tone={scoped ? undefined : 'muted'}
            >
              In: {directoryTitle}
            </Text>
            <MaterialIcons
              name={scoped ? 'close' : 'add'}
              size={14}
              color={
                scoped
                  ? mobileUiColors.primaryForeground
                  : mobileUiColors.mutedForeground
              }
            />
          </Pressable>
        </View>
      ) : null}
      <OfflineBanner />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {results.directories.length ? (
          <>
            <SectionLabel>Directories</SectionLabel>
            {results.directories.map(row)}
          </>
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
        {results.chats.length ? (
          <View
            className={
              libraryTotal ? 'mt-3 border-t border-border pt-1' : undefined
            }
          >
            <View className="mb-1 mt-4 flex-row items-center gap-1.5">
              <MaterialIcons
                name="chat-bubble-outline"
                size={14}
                color={mobileUiColors.mutedForeground}
              />
              <Text variant="label" tone="muted">
                Chats
              </Text>
            </View>
            {results.chats.map(row)}
          </View>
        ) : null}
        {notice ? (
          <Text tone="muted" className="mt-6 text-center">
            {notice}
          </Text>
        ) : null}
        {status.ready && !status.bodyTextIndexed && trimmed ? (
          <Text variant="caption" tone="muted" className="mt-3">
            Your library is too large to search inside documents on this
            device. Names are still searched.
          </Text>
        ) : status.ready && !status.chatTextIndexed && trimmed ? (
          <Text variant="caption" tone="muted" className="mt-3">
            Your library is too large to search inside chats on this device.
            Chat titles are still searched.
          </Text>
        ) : null}
        {trimmed ? (
          <Pressable
            accessibilityRole="button"
            disabled={!online}
            onPress={() => startChat(router, { message: trimmed })}
            className="mt-4 flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3"
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
                “{trimmed}”
              </Text>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

/**
 * Library search: names of directories, documents and artifacts, document
 * text, and chats (title and messages, shown apart below a divider), matched
 * on the device, so it also works offline once synced.
 */
export function SearchScreen({ directoryId }: ISearchScreen) {
  const { user } = useAuthUser();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {user ? (
        <SearchResults userId={user.uid} directoryId={directoryId} />
      ) : null}
    </SafeAreaView>
  );
}
