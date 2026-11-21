import { useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HeaderIconButton,
  Heading,
  Screen,
  ScreenHeader,
  Text,
  mobileUiColors,
} from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { usePreferencesStore } from '../preferences/store/preferencesStore';
import {
  flattenDirectoryTree,
  useDirectoryTreeQuery,
} from '../directories/api/directoryQueries';
import { useHomeSuggestions } from '../home/useHomeSuggestions';
import { MenuButton } from '../shell/HeaderButtons';
import { useShellStore } from '../shell/shellStore';
import { Composer, KeyboardAwareView, OfflineBanner } from '../shell/ui';
import { openLibraryItem } from './ChatMessageView';
import { startChat } from './chatNavigation';
import { ScopeSheet } from './ScopeSheet';

/** Home is the assistant (spec: "Frame it like ChatGPT"); the library lives in the sidebar. */
export function AssistantHomeScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const { user } = useAuthUser();
  const defaultDirectoryId = usePreferencesStore(
    (state) => state.defaultDirectoryId,
  );
  const openCapture = useShellStore((state) => state.openCapture);
  const treeQuery = useDirectoryTreeQuery();
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const suggestions = useHomeSuggestions(
    user?.uid,
    defaultDirectoryId,
    focused,
  );
  const scopeName = useMemo(
    () =>
      flattenDirectoryTree(treeQuery.data?.tree ?? []).find(
        (directory) => directory.id === scopeId,
      )?.name ?? null,
    [scopeId, treeQuery.data],
  );

  return (
    <KeyboardAwareView>
      <Screen className="pt-0">
        <ScreenHeader
          title=""
          leading={
            <>
              <MenuButton />
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Choose what the assistant can see"
                onPress={() => setScopeOpen(true)}
                className="flex-row items-center gap-1 rounded-xl px-2 py-1.5"
              >
                <Heading level={3} numberOfLines={1}>
                  {scopeName ?? 'StudyForge'}
                </Heading>
                <MaterialIcons
                  name="expand-more"
                  size={20}
                  color={mobileUiColors.foreground}
                />
              </Pressable>
            </>
          }
          trailing={
            <HeaderIconButton
              icon="search"
              accessibilityLabel="Search your library"
              onPress={() => router.push('/search')}
            />
          }
        />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingBottom: 12,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Heading level={2} className="mb-auto pt-[30%] text-center">
            {scopeName
              ? `What do you want from ${scopeName}?`
              : 'What are we studying today?'}
          </Heading>
          {suggestions.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              // A ScrollView grows by default; inside this column it would fill the
              // free height and stretch every card to match.
              style={{ flexGrow: 0 }}
              className="-mx-container px-container"
            >
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.key}
                  accessibilityRole="button"
                  onPress={() => openLibraryItem(router, suggestion.item)}
                  className="w-52 gap-0.5 rounded-2xl border border-border px-3.5 py-3"
                >
                  <Text className="font-sans-semibold" variant="caption">
                    {suggestion.label}
                  </Text>
                  <Text tone="muted" variant="caption" numberOfLines={1}>
                    {suggestion.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </ScrollView>
      </Screen>
      <OfflineBanner />
      <Composer
        placeholder={
          scopeName ? `Ask about ${scopeName}` : 'Ask about your library'
        }
        onCapture={() => openCapture(scopeId)}
        onSend={(message) =>
          startChat(router, {
            message,
            directoryId: scopeId,
            label: scopeName ?? undefined,
          })
        }
      />
      <ScopeSheet
        visible={scopeOpen}
        directoryId={scopeId}
        onClose={() => setScopeOpen(false)}
        onChange={(id) => {
          setScopeId(id);
          setScopeOpen(false);
        }}
      />
    </KeyboardAwareView>
  );
}
