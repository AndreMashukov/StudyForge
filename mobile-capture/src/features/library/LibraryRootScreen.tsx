import { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import {
  HeaderIconButton,
  Heading,
  Screen,
  ScreenHeader,
  Text,
} from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { useDirectoryTreeQuery } from '../directories/api/directoryQueries';
import { getRecentlyOpened } from '../../lib/storage/recentlyOpened';
import { getCallableErrorMessage } from '../../lib/api/studyforgeApi';
import { openLibraryItem } from '../assistant/ChatMessageView';
import { BackOrMenuButton } from '../shell/HeaderButtons';
import { useShellStore } from '../shell/shellStore';
import { ItemRow, OfflineBanner, SectionLabel } from '../shell/ui';
import { flattenTree } from './libraryUtils';
import { useLiveDirectoryTree } from './libraryData';
import {
  itemIcon,
  itemKindLabel,
  type ILibraryItemRef,
} from './itemNavigation';
import { isAgentReferencedItemType } from './libraryTypes';

export function LibraryRootScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const { user } = useAuthUser();
  const treeQuery = useDirectoryTreeQuery();
  useLiveDirectoryTree(user?.uid, focused);
  const openCapture = useShellStore((state) => state.openCapture);
  const openNewDirectory = useShellStore((state) => state.openNewDirectory);
  const roots = useMemo(
    () =>
      flattenTree(treeQuery.data?.tree ?? [])
        .filter((directory) => !directory.parentId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [treeQuery.data],
  );
  const recent = useMemo(
    () =>
      focused
        ? getRecentlyOpened()
            .flatMap((item): ILibraryItemRef[] =>
              isAgentReferencedItemType(item.itemType)
                ? [
                    {
                      itemType: item.itemType,
                      id: item.id,
                      title: item.title,
                      directoryId: item.directoryId,
                    },
                  ]
                : [],
            )
            .slice(0, 5)
        : [],
    [focused],
  );

  return (
    <>
      <Screen className="pt-0">
        <ScreenHeader
          title=""
          leading={<BackOrMenuButton />}
          trailing={
            <>
              <HeaderIconButton
                icon="search"
                accessibilityLabel="Search your library"
                onPress={() => router.push('/search')}
              />
              <HeaderIconButton
                icon="add"
                accessibilityLabel="Capture"
                onPress={() => openCapture(null)}
              />
            </>
          }
        />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <Heading level={1} className="mb-2">
            Library
          </Heading>
          {treeQuery.error ? (
            <Text tone="destructive">
              {getCallableErrorMessage(treeQuery.error)}
            </Text>
          ) : null}
          {roots.map((directory) => (
            <ItemRow
              key={directory.id}
              icon="folder"
              title={directory.name}
              subtitle={`${directory.childCount} directories · ${directory.documentCount} documents`}
              onPress={() =>
                router.push({
                  pathname: '/dir/[id]',
                  params: { id: directory.id },
                })
              }
            />
          ))}
          <ItemRow
            icon="create-new-folder"
            title="New directory"
            trailingIcon={null}
            onPress={() => openNewDirectory(null)}
          />
          {recent.length ? (
            <>
              <SectionLabel>Recently opened</SectionLabel>
              {recent.map((item) => (
                <ItemRow
                  key={`${item.itemType}:${item.id}`}
                  icon={itemIcon(item.itemType)}
                  title={item.title}
                  subtitle={itemKindLabel(item.itemType)}
                  onPress={() => openLibraryItem(router, item)}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      </Screen>
      <OfflineBanner />
    </>
  );
}
