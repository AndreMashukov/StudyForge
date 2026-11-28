import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Spinner, Text } from '@studyforge/mobile-ui';
import type { AgentProposedDelete } from '@shared-types';
import { normalizeAgentReplyMarkdown } from '@shared-types';
import { parseDocumentBlocks } from '../library/documentBlocks';
import { ReaderBlock } from '../library/ReaderBlock';
import {
  itemHref,
  itemIcon,
  itemKindLabel,
  openItemOnWeb,
  getWebOrigin,
  type ILibraryItemRef,
} from '../library/itemNavigation';
import { ItemRow } from '../shell/ui';
import { openLink } from '../library/ReaderBlock';
import { replyCards, type IChatMessage } from './agentEvents';
import { RichReplyView } from './RichReplyView';
import { shouldUseRichReplyView } from './richReply';

export function openLibraryItem(
  router: ReturnType<typeof useRouter>,
  item: ILibraryItemRef,
): void {
  const href = itemHref(item);
  if (href) router.push(href);
  else openItemOnWeb(item);
}

function deleteProposalUrl(proposal: AgentProposedDelete): string {
  const origin = getWebOrigin();
  switch (proposal.targetType) {
    case 'directory':
      return `${origin}/directory/${encodeURIComponent(proposal.targetId)}`;
    case 'document':
      return `${origin}/document/${encodeURIComponent(proposal.targetId)}`;
    case 'quiz':
      return `${origin}/quiz/${encodeURIComponent(proposal.targetId)}`;
    case 'rule':
      return `${origin}/rules`;
  }
}

/** Deletes are confirmed on the web in v1 (revised decision 14). */
function DeleteProposalCard({ proposal }: { proposal: AgentProposedDelete }) {
  return (
    <View className="gap-2 rounded-2xl border border-border p-3">
      <Text className="font-sans-medium">Delete {proposal.label}?</Text>
      {proposal.reason ? (
        <Text variant="caption" tone="muted">
          {proposal.reason}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        Deleting is confirmed in the web app.
      </Text>
      <Button
        label="Confirm on the web"
        size="sm"
        variant="secondary"
        icon="open-in-new"
        onPress={() => openLink(deleteProposalUrl(proposal))}
      />
    </View>
  );
}

export function ChatMessageView({ message }: { message: IChatMessage }) {
  const router = useRouter();
  const replyMarkdown = useMemo(
    () =>
      message.role === 'assistant' && message.content
        ? normalizeAgentReplyMarkdown(message.content)
        : '',
    [message.content, message.role],
  );
  const blocks = useMemo(
    () => (replyMarkdown ? parseDocumentBlocks(replyMarkdown, 'markdown') : []),
    [replyMarkdown],
  );
  const richReply = shouldUseRichReplyView({
    role: message.role,
    streaming: message.streaming,
    normalizedContent: replyMarkdown,
  });
  const cards = replyCards(message);

  if (message.role === 'user') {
    return (
      <View className="max-w-[82%] gap-1 self-end rounded-3xl bg-card px-4 py-2.5">
        {message.agentPromptName ? (
          <Text className="font-sans-medium" tone="muted" variant="caption">
            /{message.agentPromptName}
          </Text>
        ) : null}
        {message.content ? <Text>{message.content}</Text> : null}
      </View>
    );
  }

  const nativeBlocks = blocks.map((block, index) => (
    <ReaderBlock key={index} block={block} />
  ));

  return (
    <View className="gap-1">
      {message.streaming ? (
        <View className="flex-row items-center gap-2 py-1">
          <Spinner />
          <Text tone="muted" variant="caption">
            {message.status ?? 'Thinking…'}
          </Text>
        </View>
      ) : null}
      {richReply ? (
        <RichReplyView markdown={replyMarkdown} fallback={nativeBlocks} />
      ) : (
        nativeBlocks
      )}
      {message.stuck ? (
        <Text tone="muted" variant="caption">
          Still working. This is taking longer than usual.
        </Text>
      ) : null}
      {message.note ? (
        <Text tone="muted" variant="caption">
          {message.note}
        </Text>
      ) : null}
      {cards.length ? (
        <View className="mt-1 rounded-2xl border border-border px-3">
          {cards.map((card) => (
            <ItemRow
              key={`${card.itemType}:${card.id}`}
              icon={itemIcon(card.itemType)}
              title={card.title || itemKindLabel(card.itemType)}
              subtitle={
                itemHref(card)
                  ? itemKindLabel(card.itemType)
                  : `${itemKindLabel(card.itemType)} · opens on the web`
              }
              onPress={() => openLibraryItem(router, card)}
            />
          ))}
        </View>
      ) : null}
      {message.deletes.map((proposal) => (
        <DeleteProposalCard
          key={`${proposal.targetType}:${proposal.targetId}`}
          proposal={proposal}
        />
      ))}
    </View>
  );
}
