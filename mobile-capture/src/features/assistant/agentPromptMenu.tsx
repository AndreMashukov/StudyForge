import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  buildAgentPromptMenu,
  findAgentPromptSlashTrigger,
  type IAgentPromptMenuItem,
} from '@shared-types';
import { listAgentPromptRulesFromFirestore } from '@studyforge/client-data/agentPromptFirestore';
import { Spinner, Text, mobileUiColors } from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { listSuggestedAgentPrompts } from '../../lib/api/studyforgeApi';
import { queryKeys } from '../../lib/api/queryKeys';

/**
 * "/" menu data for the mobile composer (ADR 017): the learner's agent
 * prompts, then suggested ones, filtered by what follows the "/". Mobile
 * types at the end of the text, so the caret is taken to be there.
 */
export function useAgentPromptMenu(input: {
  enabled: boolean;
  text: string;
  picked: IAgentPromptMenuItem | null;
}) {
  const { user } = useAuthUser();
  const userId = user?.uid;
  const trigger =
    input.enabled && !input.picked
      ? findAgentPromptSlashTrigger(input.text, input.text.length)
      : null;
  const open = Boolean(trigger);

  const rulesQuery = useQuery({
    queryKey: queryKeys.agentPromptRules(userId ?? ''),
    enabled: Boolean(userId) && open,
    staleTime: 30_000,
    queryFn: () => {
      if (!userId) throw new Error('Sign in to see your prompts');
      return listAgentPromptRulesFromFirestore(userId);
    },
  });
  const suggestedQuery = useQuery({
    queryKey: queryKeys.suggestedAgentPrompts(),
    enabled: Boolean(userId) && open,
    staleTime: 10 * 60_000,
    queryFn: listSuggestedAgentPrompts,
  });

  const query = trigger?.query ?? '';
  const menu = useMemo(
    () =>
      buildAgentPromptMenu({
        rules: rulesQuery.data ?? [],
        suggested: suggestedQuery.data ?? [],
        query,
      }),
    [query, rulesQuery.data, suggestedQuery.data],
  );

  /** The text with the typed "/query" removed, for when a row is picked. */
  const textWithoutTrigger = trigger
    ? input.text.slice(0, trigger.start).trimEnd()
    : input.text;

  return {
    open,
    query,
    loading: rulesQuery.isLoading || suggestedQuery.isLoading,
    own: menu.own,
    suggested: menu.suggested,
    textWithoutTrigger,
  };
}

function MenuSection({
  title,
  items,
  onPick,
}: {
  title: string;
  items: IAgentPromptMenuItem[];
  onPick: (item: IAgentPromptMenuItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View>
      <Text variant="caption" tone="muted" className="px-3 pb-1 pt-2">
        {title}
      </Text>
      {items.map((item) => (
        <Pressable
          key={`${item.source}:${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Run prompt ${item.name}`}
          onPress={() => onPick(item)}
          className="px-3 py-2 active:bg-card"
        >
          <Text className="font-sans-medium" numberOfLines={1}>
            /{item.name}
          </Text>
          {item.description ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** The list above the composer while "/" is typed. */
export function AgentPromptMenuView({
  menu,
  onPick,
}: {
  menu: ReturnType<typeof useAgentPromptMenu>;
  onPick: (item: IAgentPromptMenuItem) => void;
}) {
  const empty = menu.own.length + menu.suggested.length === 0;
  return (
    <View
      accessibilityLabel="Saved prompts"
      className="mb-1.5 max-h-64 overflow-hidden rounded-2xl border border-border bg-background"
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        {menu.loading && empty ? (
          <View className="flex-row items-center gap-2 px-3 py-3">
            <Spinner />
            <Text tone="muted" variant="caption">
              Loading prompts…
            </Text>
          </View>
        ) : empty ? (
          <Text tone="muted" variant="caption" className="px-3 py-3">
            {menu.query
              ? `No prompts match "/${menu.query}".`
              : 'No prompts yet. Ask the assistant to save one.'}
          </Text>
        ) : (
          <>
            <MenuSection title="Your prompts" items={menu.own} onPick={onPick} />
            <MenuSection
              title="Suggested"
              items={menu.suggested}
              onPick={onPick}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** The picked prompt above the composer, removable. */
export function AgentPromptChipView({
  name,
  onRemove,
}: {
  name: string;
  onRemove?: () => void;
}) {
  return (
    <View className="mb-1.5 flex-row self-start items-center gap-1 rounded-full border border-primary bg-card px-3 py-1">
      <MaterialIcons name="auto-awesome" size={14} color={mobileUiColors.primary} />
      <Text variant="caption" className="font-sans-medium" numberOfLines={1}>
        /{name}
      </Text>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove prompt ${name}`}
          onPress={onRemove}
          hitSlop={8}
        >
          <MaterialIcons name="close" size={14} color={mobileUiColors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}
