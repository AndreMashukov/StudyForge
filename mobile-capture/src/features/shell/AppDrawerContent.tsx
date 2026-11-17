import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useDrawerStatus } from '@react-navigation/drawer';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, mobileUiColors } from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import {
  flattenDirectoryTree,
  useDirectoryTreeQuery,
  type IMobileDirectory,
} from '../directories/api/directoryQueries';
import { useAgentThreads } from '../assistant/useAgentChat';
import { getRecentlyOpened } from '../../lib/storage/recentlyOpened';
import { itemHref, itemIcon } from '../library/itemNavigation';
import { isAgentReferencedItemType } from '../library/libraryTypes';
import { useShellStore } from './shellStore';

type IconName = keyof typeof MaterialIcons.glyphMap;

function DrawerItem({
  icon,
  label,
  onPress,
  depth = 0,
  trailing,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  depth?: number;
  trailing?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ paddingLeft: 10 + depth * 18 }}
      className="min-h-11 flex-row items-center gap-2.5 rounded-xl pr-2.5 active:bg-card"
    >
      <MaterialIcons
        name={icon}
        size={20}
        color={mobileUiColors.mutedForeground}
      />
      <Text numberOfLines={1} className="flex-1">
        {label}
      </Text>
      {trailing ? (
        <Text variant="caption" tone="muted">
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}

function DrawerHeading({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted" className="px-2.5 pb-1 pt-4">
      {children}
    </Text>
  );
}

/**
 * Sidebar from the spec: search on top, then the directory tree, then recent items
 * and chats. Directories expand in place; tapping one opens its drill-down page.
 */
export function AppDrawerContent({ navigation }: DrawerContentComponentProps) {
  const router = useRouter();
  const drawerOpen = useDrawerStatus() === 'open';
  const { user } = useAuthUser();
  const treeQuery = useDirectoryTreeQuery();
  const threadsQuery = useAgentThreads(user?.uid, 8);
  const openNewDirectory = useShellStore((state) => state.openNewDirectory);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const directories = useMemo(
    () => flattenDirectoryTree(treeQuery.data?.tree ?? []),
    [treeQuery.data],
  );
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, IMobileDirectory[]>();
    const ids = new Set(directories.map((directory) => directory.id));
    for (const directory of directories) {
      const parent =
        directory.parentId && ids.has(directory.parentId)
          ? directory.parentId
          : null;
      map.set(parent, [...(map.get(parent) ?? []), directory]);
    }
    for (const list of map.values())
      list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [directories]);
  const recent = useMemo(
    () =>
      drawerOpen
        ? getRecentlyOpened()
            .filter((item) => isAgentReferencedItemType(item.itemType))
            .slice(0, 3)
        : [],
    [drawerOpen],
  );

  const go = (href: Href) => {
    navigation.closeDrawer();
    router.push(href);
  };

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderTree = (
    parentId: string | null,
    depth: number,
  ): React.ReactNode =>
    (childrenOf.get(parentId) ?? []).map((directory) => {
      const kids = childrenOf.get(directory.id) ?? [];
      const open = expanded.has(directory.id);
      return (
        <View key={directory.id}>
          <View
            className="flex-row items-center"
            style={{ paddingLeft: depth * 18 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${directory.name}`}
              disabled={!kids.length}
              onPress={() => toggle(directory.id)}
              className="h-11 w-7 items-center justify-center"
            >
              {kids.length ? (
                <MaterialIcons
                  name={open ? 'expand-more' : 'chevron-right'}
                  size={20}
                  color={mobileUiColors.placeholder}
                />
              ) : null}
            </Pressable>
            <View className="flex-1">
              <DrawerItem
                icon="folder"
                label={directory.name}
                onPress={() =>
                  go({ pathname: '/dir/[id]', params: { id: directory.id } })
                }
              />
            </View>
          </View>
          {open ? renderTree(directory.id, depth + 1) : null}
        </View>
      );
    });

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-card">
      <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
        <Pressable
          accessibilityRole="search"
          onPress={() => go('/search')}
          className="h-10 flex-1 flex-row items-center gap-2 rounded-xl bg-background px-3"
        >
          <MaterialIcons
            name="search"
            size={20}
            color={mobileUiColors.placeholder}
          />
          <Text tone="muted">Search</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          onPress={() => go('/')}
          className="h-10 w-10 items-center justify-center"
        >
          <MaterialIcons
            name="edit-square"
            size={22}
            color={mobileUiColors.foreground}
          />
        </Pressable>
      </View>
      <ScrollView className="flex-1 px-2">
        <DrawerItem icon="home" label="Home" onPress={() => go('/')} />
        <DrawerItem
          icon="library-books"
          label="Library"
          onPress={() => go('/library')}
        />
        <DrawerHeading>Directories</DrawerHeading>
        {renderTree(null, 0)}
        <DrawerItem
          icon="create-new-folder"
          label="New directory"
          onPress={() => {
            navigation.closeDrawer();
            openNewDirectory(null);
          }}
        />
        {recent.length || threadsQuery.data?.length ? (
          <DrawerHeading>Recent</DrawerHeading>
        ) : null}
        {recent.map((item) => {
          if (!isAgentReferencedItemType(item.itemType)) return null;
          const ref = {
            itemType: item.itemType,
            id: item.id,
            title: item.title,
            directoryId: item.directoryId,
          };
          const href = itemHref(ref);
          return href ? (
            <DrawerItem
              key={`${item.itemType}:${item.id}`}
              icon={itemIcon(item.itemType)}
              label={item.title}
              onPress={() => go(href)}
            />
          ) : null;
        })}
        {(threadsQuery.data ?? []).map((thread) => (
          <DrawerItem
            key={thread.id}
            icon="chat-bubble-outline"
            label={thread.title}
            onPress={() =>
              go({
                pathname: '/chat/[threadId]',
                params: {
                  threadId: thread.id,
                  ...(thread.scope === 'directory' && thread.directoryId
                    ? { directoryId: thread.directoryId }
                    : {}),
                  title: thread.title,
                },
              })
            }
          />
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => go('/settings')}
        className="flex-row items-center gap-2.5 border-t border-border px-4 py-3"
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Text
            variant="caption"
            className="font-sans-semibold text-primary-foreground"
          >
            {(user?.email ?? 'S').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text numberOfLines={1} className="flex-1">
          {user?.email ?? 'Your account'}
        </Text>
        <MaterialIcons
          name="settings"
          size={20}
          color={mobileUiColors.mutedForeground}
        />
      </Pressable>
    </SafeAreaView>
  );
}
