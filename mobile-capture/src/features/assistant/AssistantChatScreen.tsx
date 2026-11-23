import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
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
import {
  Composer,
  KeyboardAwareView,
  Notice,
  OfflineBanner,
} from '../shell/ui';
import { AgentQuestionSheet } from './AgentQuestionSheet';
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

  const handleThreadCreated = useCallback(
    (threadId: string) => {
      // Drop the first message from the route so a remount never sends it twice.
      router.setParams({ threadId, message: '' });
    },
    [router],
  );
  const chat = useAgentChat(user?.uid, initialThreadId, chatScope, {
    onThreadCreated: handleThreadCreated,
  });
  const sentInitial = useRef(false);
  const listRef = useRef<FlatList>(null);
  const [dismissedQuestionsId, setDismissedQuestionsId] = useState<
    string | null
  >(null);
  const openQuestions =
    chat.openQuestions && chat.openQuestions.entryId !== dismissedQuestionsId
      ? chat.openQuestions
      : null;

  useEffect(() => {
    const first = param(params.message);
    if (!initialThreadId && first && !sentInitial.current) {
      sentInitial.current = true;
      void chat.send(first);
    }
  }, [chat, initialThreadId, params.message]);

  const title =
    param(params.title) ?? label ?? (directoryId ? 'Assistant' : 'StudyForge');

  return (
    <KeyboardAwareView>
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
      {openQuestions ? (
        <AgentQuestionSheet
          key={openQuestions.entryId}
          questions={openQuestions.questions}
          disabled={chat.isWorking || chat.limitReached}
          onSubmit={(message) => void chat.send(message)}
          onDismiss={() => setDismissedQuestionsId(openQuestions.entryId)}
        />
      ) : null}
      <Composer
        placeholder={
          openQuestions
            ? 'Or reply in your own words'
            : label
              ? `Ask about ${label}`
              : 'Ask anything'
        }
        disabled={chat.isWorking || chat.loading || chat.limitReached}
        busy={chat.isWorking}
        stopDisabled={!chat.canStop}
        onStop={() => void chat.stop()}
        onCapture={() => openCapture(directoryId ?? null)}
        onSend={(message) => void chat.send(message)}
      />
    </KeyboardAwareView>
  );
}
