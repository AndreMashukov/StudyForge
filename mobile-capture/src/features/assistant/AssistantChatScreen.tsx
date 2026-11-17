import { useEffect, useMemo, useRef } from 'react';
import { FlatList, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AgentPromptContext } from '@shared-types';
import {
  HeaderIconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  Text,
} from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { BackOrMenuButton } from '../shell/HeaderButtons';
import { useShellStore } from '../shell/shellStore';
import { Composer, Notice, OfflineBanner } from '../shell/ui';
import { ChatMessageView } from './ChatMessageView';
import { useAgentChat, type IAgentChatScope } from './useAgentChat';

function param(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** One conversation. `threadId` is "new" for a fresh chat, optionally with a first message to send. */
export function AssistantChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    threadId: string;
    message?: string;
    directoryId?: string;
    documentId?: string;
    label?: string;
    title?: string;
  }>();
  const { user } = useAuthUser();
  const openCapture = useShellStore((state) => state.openCapture);
  const routeThreadId = param(params.threadId);
  const initialThreadId =
    routeThreadId && routeThreadId !== 'new' ? routeThreadId : null;
  const directoryId = param(params.directoryId);
  const documentId = param(params.documentId);
  const label = param(params.label);

  const chatScope = useMemo<IAgentChatScope>(() => {
    const promptContext: AgentPromptContext | undefined = documentId
      ? {
          type: 'document',
          documentId,
          ...(directoryId ? { directoryId } : {}),
          ...(label ? { label } : {}),
        }
      : directoryId
        ? { type: 'directory', directoryId, ...(label ? { label } : {}) }
        : undefined;
    return directoryId
      ? { scope: 'directory', directoryId, promptContext }
      : { scope: 'workspace', promptContext };
  }, [directoryId, documentId, label]);

  const chat = useAgentChat(user?.uid, initialThreadId, chatScope);
  const sentInitial = useRef(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const first = param(params.message);
    if (!initialThreadId && first && !sentInitial.current) {
      sentInitial.current = true;
      void chat.send(first);
    }
  }, [chat, initialThreadId, params.message]);

  const title =
    param(params.title) ??
    label ??
    (directoryId ? 'Directory chat' : 'StudyForge');

  return (
    <View className="flex-1 bg-background">
      <Screen className="pt-0">
        <ScreenHeader
          title={title}
          leading={<BackOrMenuButton />}
          trailing={
            <HeaderIconButton
              icon="edit-square"
              accessibilityLabel="New chat"
              onPress={() => router.replace('/')}
            />
          }
        />
        {chat.loading ? (
          <LoadingState message="Loading chat…" />
        ) : (
          <FlatList
            ref={listRef}
            data={chat.messages}
            keyExtractor={(message) => message.id}
            contentContainerStyle={{ gap: 16, paddingVertical: 12 }}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <ChatMessageView message={item} />}
            ListEmptyComponent={
              <Text tone="muted" className="mt-8 text-center">
                Ask anything about your library.
              </Text>
            }
            ListFooterComponent={
              chat.error ? (
                <Notice tone={chat.limitReached ? 'muted' : 'destructive'}>
                  {chat.error}
                </Notice>
              ) : null
            }
          />
        )}
      </Screen>
      <OfflineBanner />
      <Composer
        placeholder={label ? `Ask about ${label}` : 'Ask anything'}
        disabled={chat.sending || chat.loading || chat.limitReached}
        onCapture={() => openCapture(directoryId ?? null)}
        onSend={(message) => void chat.send(message)}
      />
    </View>
  );
}
