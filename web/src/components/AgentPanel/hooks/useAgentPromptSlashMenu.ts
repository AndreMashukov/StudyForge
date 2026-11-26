import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import {
  buildAgentPromptMenu,
  findAgentPromptSlashTrigger,
  RuleApplicability,
  RuleColor,
  type IAgentPromptMenuItem,
} from '@shared-types';
import {
  useCreateRuleMutation,
  useGetRulesQuery,
} from '../../../store/api/Rules';
import { useListSuggestedAgentPromptsQuery } from '../../../store/api/AgentThread';
import { useToast } from '../../Toast';

export interface IAgentPromptSlashMenu {
  /** The prompt picked for the next message, shown as a chip. */
  picked: IAgentPromptMenuItem | null;
  setPicked: (item: IAgentPromptMenuItem | null) => void;
  isOpen: boolean;
  isLoading: boolean;
  query: string;
  own: IAgentPromptMenuItem[];
  suggested: IAgentPromptMenuItem[];
  /** Index into own followed by suggested. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  savingCopyId: string | null;
  handlePick: (item: IAgentPromptMenuItem) => void;
  handleSaveCopy: (item: IAgentPromptMenuItem) => Promise<void>;
  handleDismiss: () => void;
  handleChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  handleSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
  /** Returns true when the key was handled by the menu. */
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

/**
 * The "/" menu of the agent composer (ADR 017): typing "/" at the start or
 * after a space lists the learner's agent prompts, then suggested ones.
 * Picking one removes the typed "/query" and shows the prompt as a chip.
 */
export function useAgentPromptSlashMenu(input: {
  enabled: boolean;
  value: string;
  setValue: (value: string) => void;
  maxLength: number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}): IAgentPromptSlashMenu {
  const { enabled, value, setValue, maxLength, textareaRef } = input;
  const { showToast } = useToast();
  const [caret, setCaret] = useState(value.length);
  const [picked, setPicked] = useState<IAgentPromptMenuItem | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const [hasOpened, setHasOpened] = useState(false);
  const [savingCopyId, setSavingCopyId] = useState<string | null>(null);

  const trigger =
    enabled && !picked ? findAgentPromptSlashTrigger(value, caret) : null;
  const isOpen = Boolean(trigger) && trigger?.start !== dismissedStart;
  const skipData = !enabled || (!isOpen && !hasOpened);

  const { data: rules, isLoading: isRulesLoading } = useGetRulesQuery(
    undefined,
    { skip: skipData },
  );
  const { data: suggestedPrompts, isLoading: isSuggestedLoading } =
    useListSuggestedAgentPromptsQuery(undefined, { skip: skipData });
  const [createRule] = useCreateRuleMutation();

  const query = trigger?.query ?? '';
  const menu = useMemo(
    () =>
      buildAgentPromptMenu({
        rules: rules ?? [],
        suggested: suggestedPrompts ?? [],
        query,
      }),
    [query, rules, suggestedPrompts],
  );
  const items = useMemo(
    () => [...menu.own, ...menu.suggested],
    [menu.own, menu.suggested],
  );
  const clampedIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const placeCaret = useCallback(
    (position: number) => {
      setCaret(position);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(position, position);
        }
      });
    },
    [textareaRef],
  );

  const handlePick = useCallback(
    (item: IAgentPromptMenuItem) => {
      if (!trigger) {
        return;
      }
      const end = trigger.start + 1 + trigger.query.length;
      const before = value.slice(0, trigger.start);
      const after = value.slice(end).replace(/^\s+/, '');
      setValue(`${before}${after}`);
      setPicked(item);
      setActiveIndex(0);
      placeCaret(before.length);
    },
    [placeCaret, setValue, trigger, value],
  );

  const handleSaveCopy = useCallback(
    async (item: IAgentPromptMenuItem) => {
      const prompt = suggestedPrompts?.find((entry) => entry.id === item.id);
      if (!prompt) {
        return;
      }
      setSavingCopyId(prompt.id);
      try {
        await createRule({
          name: prompt.name,
          description: prompt.description ?? '',
          content: prompt.content,
          color: RuleColor.PURPLE,
          tags: [],
          applicableTo: [RuleApplicability.AGENT],
          sourceBlueprintId: prompt.id,
          sourceBlueprintVersion: prompt.version,
          sourceBlueprintName: prompt.name,
        }).unwrap();
        showToast(`Saved a copy of "${prompt.name}" to your prompts`, 'success');
      } catch {
        // The global error toast middleware shows the failure.
      } finally {
        setSavingCopyId(null);
      }
    },
    [createRule, showToast, suggestedPrompts],
  );

  const handleDismiss = useCallback(() => {
    if (trigger) {
      setDismissedStart(trigger.start);
    }
  }, [trigger]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value.slice(0, maxLength);
      const nextCaret = event.target.selectionStart ?? nextValue.length;
      setValue(nextValue);
      setCaret(nextCaret);
      setActiveIndex(0);
      const nextTrigger = enabled
        ? findAgentPromptSlashTrigger(nextValue, nextCaret)
        : null;
      if (nextTrigger) {
        setHasOpened(true);
      }
      if (!nextTrigger || nextTrigger.start !== dismissedStart) {
        setDismissedStart(null);
      }
    },
    [dismissedStart, enabled, maxLength, setValue],
  );

  const handleSelect = useCallback(
    (event: SyntheticEvent<HTMLTextAreaElement>) => {
      setCaret(event.currentTarget.selectionStart ?? 0);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (isOpen) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (items.length > 0) {
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex(
              (clampedIndex + step + items.length) % items.length,
            );
          }
          return true;
        }
        if (
          (event.key === 'Enter' && !event.shiftKey) ||
          event.key === 'Tab'
        ) {
          const item = items[clampedIndex];
          if (item) {
            event.preventDefault();
            handlePick(item);
            return true;
          }
          return false;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          handleDismiss();
          return true;
        }
      }
      // Backspace at the very start removes the picked prompt.
      if (
        picked &&
        event.key === 'Backspace' &&
        event.currentTarget.selectionStart === 0 &&
        event.currentTarget.selectionEnd === 0
      ) {
        event.preventDefault();
        setPicked(null);
        return true;
      }
      return false;
    },
    [clampedIndex, handleDismiss, handlePick, isOpen, items, picked],
  );

  return {
    picked,
    setPicked,
    isOpen,
    isLoading: isRulesLoading || isSuggestedLoading,
    query,
    own: menu.own,
    suggested: menu.suggested,
    activeIndex: clampedIndex,
    setActiveIndex,
    savingCopyId,
    handlePick,
    handleSaveCopy,
    handleDismiss,
    handleChange,
    handleSelect,
    handleKeyDown,
  };
}
