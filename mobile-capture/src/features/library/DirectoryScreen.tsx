import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HeaderIconButton,
  Heading,
  LoadingState,
  Screen,
  ScreenHeader,
  Text,
  mobileUiColors,
} from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { useDirectoryTreeQuery } from '../directories/api/directoryQueries';
import { useDirectoryAgentThreads } from '../assistant/useAgentChat';
import { startChat } from '../assistant/chatNavigation';
import { BackOrMenuButton } from '../shell/HeaderButtons';
import { useShellStore } from '../shell/shellStore';
import { Composer, ItemRow, OfflineBanner, SectionLabel } from '../shell/ui';
import { getCallableErrorMessage } from '../../lib/api/studyforgeApi';
import { flattenTree, getBreadcrumbs } from './libraryUtils';
import { useDirectoryItems, useLiveDirectoryTree } from './libraryData';
import { LibraryItemRow } from './libraryRows';
import {
  compareFolderOrder,
  sortArtifactsForDisplay,
  sortDocumentsForDisplay,
} from '@shared-types';

type Segment = 'documents' | 'artifacts' | 'chats';

/**
 * Drill-down directory page (spec recommendation 3): breadcrumb, subdirectories,
 * then documents / artifacts / chats on one page. Chats are the threads
 * started in this folder (home folder). The composer asks the
 * directory-scoped agent; + captures into this directory.
 */
export function DirectoryScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ id: string }>();
  const directoryId = typeof params.id === 'string' ? params.id : null;
  const { user } = useAuthUser();
  const treeQuery = useDirectoryTreeQuery();
  useLiveDirectoryTree(user?.uid, focused);
  const itemsQuery = useDirectoryItems(user?.uid, directoryId, focused);
  const threadsQuery = useDirectoryAgentThreads(user?.uid, directoryId, focused);
  const openCapture = useShellStore((state) => state.openCapture);
  const openNewDirectory = useShellStore((state) => state.openNewDirectory);
  const [segment, setSegment] = useState<Segment | null>(null);

  const directories = useMemo(
    () => flattenTree(treeQuery.data?.tree ?? []),
    [treeQuery.data],
  );
  const directory =
    directories.find((entry) => entry.id === directoryId) ?? null;
  const breadcrumbs = useMemo(
    () => getBreadcrumbs(directories, directoryId),
    [directories, directoryId],
  );
  const children = useMemo(
    () =>
      directories
        .filter((entry) => entry.parentId === directoryId)
        .sort(compareFolderOrder),
    [directories, directoryId],
  );
  const items = useMemo(
    () =>
      (itemsQuery.data ?? []).filter(
        (item) => item.itemType !== 'subdirectory',
      ),
    [itemsQuery.data],
  );
  // Same order as the web folder page: documents by drag order, else newest
  // first; artifacts of every type mixed, newest first.
  const documents = useMemo(
    () =>
      sortDocumentsForDisplay(
        items.filter((item) => item.itemType === 'document'),
      ),
    [items],
  );
  const artifacts = useMemo(
    () =>
      sortArtifactsForDisplay(
        items.filter((item) => item.itemType !== 'document'),
      ),
    [items],
  );
  const chats = threadsQuery.data ?? [];
  const active: Segment =
    segment ??
    (documents.length || !artifacts.length ? 'documents' : 'artifacts');
  const error = itemsQuery.liveError ?? itemsQuery.error;

  if (!directory) {
    return treeQuery.isLoading ? (
      <LoadingState message="Loading directory…" />
    ) : (
      <Screen className="pt-0">
        <ScreenHeader title="Directory" leading={<BackOrMenuButton />} />
        <Text tone="muted" className="mt-6">
          This directory is no longer available.
        </Text>
      </Screen>
    );
  }

  const segments: Array<[Segment, string, number]> = [
    ['documents', 'Documents', documents.length],
    ['artifacts', 'Artifacts', artifacts.length],
    ['chats', 'Chats', chats.length],
  ];

  return (
    <View className="flex-1 bg-background">
      <Screen className="pt-0">
        <ScreenHeader
          title=""
          leading={<BackOrMenuButton />}
          trailing={
            <>
              <HeaderIconButton
                icon="search"
                accessibilityLabel={`Search in ${directory.name}`}
                onPress={() =>
                  router.push({
                    pathname: '/search',
                    params: { directoryId: directory.id },
                  })
                }
              />
              <HeaderIconButton
                icon="add"
                accessibilityLabel={`Capture into ${directory.name}`}
                onPress={() => openCapture(directory.id)}
              />
              <HeaderIconButton
                icon="create-new-folder"
                accessibilityLabel={`New directory inside ${directory.name}`}
                onPress={() => openNewDirectory(directory.id, directory.name)}
              />
            </>
          }
        />
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={undefined}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center' }}
          >
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/library')}
              className="px-1 py-1"
            >
              <Text variant="caption" tone="muted">
                Library
              </Text>
            </Pressable>
            {breadcrumbs.map((crumb, index) => (
              <View key={crumb.id} className="flex-row items-center">
                <Text variant="caption" tone="muted">
                  {' '}
                  ›{' '}
                </Text>
                {index === breadcrumbs.length - 1 ? (
                  <Text variant="caption" className="font-sans-medium">
                    {crumb.name}
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      router.push({
                        pathname: '/dir/[id]',
                        params: { id: crumb.id },
                      })
                    }
                    className="px-1 py-1"
                  >
                    <Text variant="caption" tone="muted">
                      {crumb.name}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>

          <View className="mt-3 mb-1 flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card">
              <MaterialIcons
                name="folder"
                size={24}
                color={mobileUiColors.foreground}
              />
            </View>
            <View className="flex-1">
              <Heading level={2} numberOfLines={2}>
                {directory.name}
              </Heading>
              <Text variant="caption" tone="muted">
                {children.length + items.length} item
                {children.length + items.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>

          {children.length ? (
            <>
              <SectionLabel>Directories</SectionLabel>
              {children.map((child) => (
                <ItemRow
                  key={child.id}
                  icon="folder"
                  title={child.name}
                  subtitle={`${child.documentCount} documents`}
                  onPress={() =>
                    router.push({
                      pathname: '/dir/[id]',
                      params: { id: child.id },
                    })
                  }
                />
              ))}
            </>
          ) : null}

          <View
            accessibilityRole="tablist"
            className="mt-4 mb-1 flex-row rounded-xl bg-card p-1"
          >
            {segments.map(([key, label, count]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active === key }}
                onPress={() => setSegment(key)}
                className={`h-8 flex-1 items-center justify-center rounded-lg ${active === key ? 'bg-background' : ''}`}
              >
                <Text
                  variant="caption"
                  className="font-sans-medium"
                  tone={active === key ? 'default' : 'muted'}
                >
                  {label}
                  {count ? ` ${count}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>

          {itemsQuery.isLoading && !itemsQuery.data ? (
            <Text tone="muted" className="mt-3">
              Loading…
            </Text>
          ) : null}
          {error ? (
            <Text tone="destructive" className="mt-3">
              {getCallableErrorMessage(error)}
            </Text>
          ) : null}

          {active === 'documents' ? (
            documents.length ? (
              documents.map((item) => (
                <LibraryItemRow key={item.id} item={item} router={router} />
              ))
            ) : (
              <Text tone="muted" className="mt-4">
                No documents yet. Tap + to capture one here.
              </Text>
            )
          ) : null}
          {active === 'artifacts' ? (
            artifacts.length ? (
              artifacts.map((item) => (
                <LibraryItemRow key={item.id} item={item} router={router} />
              ))
            ) : (
              <Text tone="muted" className="mt-4">
                No artifacts yet. Open a document and tap + Quiz or +
                Flashcards.
              </Text>
            )
          ) : null}
          {active === 'chats' ? (
            chats.length ? (
              chats.map((thread) => (
                <ItemRow
                  key={thread.id}
                  icon="chat-bubble-outline"
                  title={thread.title}
                  subtitle={thread.preview}
                  onPress={() =>
                    router.push({
                      pathname: '/chat/[threadId]',
                      params: {
                        threadId: thread.id,
                        directoryId: directory.id,
                        label: directory.name,
                        title: thread.title,
                      },
                    })
                  }
                />
              ))
            ) : (
              <Text tone="muted" className="mt-4">
                No chats here yet. Ask something below.
              </Text>
            )
          ) : null}
        </ScrollView>
      </Screen>
      <OfflineBanner />
      <Composer
        placeholder={`Ask about ${directory.name}`}
        onCapture={() => openCapture(directory.id)}
        onSend={(message) =>
          startChat(router, {
            message,
            directoryId: directory.id,
            label: directory.name,
          })
        }
      />
    </View>
  );
}
