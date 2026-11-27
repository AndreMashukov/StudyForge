import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Tag } from "lucide-react";
import { Checkbox } from "../ui/Checkbox";
import {
  useGetApplicableRulesQuery,
  useSetRuleAlwaysApplyMutation,
} from "../../store/api/Rules/rulesApi";
import { RuleListSkeleton } from "../LoadingSkeletons";
import { VirtualizedList } from "../VirtualizedList";
import { ICompactRuleSelector } from "./ICompactRuleSelector";

/**
 * Prompt picker (ADR 018). It opens with the folder's default prompts ticked,
 * and every tick or untick is saved at once as this folder's default, so the
 * picker reopens the way it was left. Only this folder changes: subfolders,
 * parents and siblings keep their own state.
 */
export const CompactRuleSelector = ({
  directoryId,
  operation,
  selectedRuleIds,
  onSelectionChange,
  label = "Prompts",
}: ICompactRuleSelector) => {
  const { data, isLoading, isSuccess } = useGetApplicableRulesQuery({
    directoryId,
    operation,
  });
  const [setRuleAlwaysApply] = useSetRuleAlwaysApplyMutation();
  const [savingRuleIds, setSavingRuleIds] = useState<string[]>([]);
  const initializedKeyRef = useRef<string | null>(null);
  const selectionKey = `${directoryId}:${operation}`;

  const rules = data?.rules || [];
  const defaultRuleIds = data?.defaultRuleIds;

  // Latest selection, so a failed save can put back just its own tick.
  const selectedRuleIdsRef = useRef(selectedRuleIds);
  useEffect(() => {
    selectedRuleIdsRef.current = selectedRuleIds;
  }, [selectedRuleIds]);

  // Start from the folder's default prompts once per directory/operation
  useEffect(() => {
    if (!isSuccess || initializedKeyRef.current === selectionKey) {
      return;
    }
    initializedKeyRef.current = selectionKey;
    if (selectedRuleIds.length === 0 && defaultRuleIds && defaultRuleIds.length > 0) {
      onSelectionChange(defaultRuleIds);
    }
  }, [
    isSuccess,
    selectionKey,
    defaultRuleIds,
    selectedRuleIds.length,
    onSelectionChange,
  ]);

  const handleToggle = useCallback(
    async (ruleId: string) => {
      if (savingRuleIds.includes(ruleId)) {
        return;
      }
      const alwaysApply = !selectedRuleIdsRef.current.includes(ruleId);
      const withTick = (ids: string[], ticked: boolean) =>
        ticked
          ? ids.includes(ruleId)
            ? ids
            : [...ids, ruleId]
          : ids.filter((id) => id !== ruleId);

      const applySelection = (ticked: boolean) => {
        const next = withTick(selectedRuleIdsRef.current, ticked);
        selectedRuleIdsRef.current = next;
        onSelectionChange(next);
      };

      applySelection(alwaysApply);
      setSavingRuleIds((ids) => [...ids, ruleId]);
      try {
        await setRuleAlwaysApply({ ruleId, directoryId, alwaysApply }).unwrap();
      } catch {
        // Error is shown via the global errorToastMiddleware toast
        applySelection(!alwaysApply);
      } finally {
        setSavingRuleIds((ids) => ids.filter((id) => id !== ruleId));
      }
    },
    [directoryId, onSelectionChange, savingRuleIds, setRuleAlwaysApply],
  );

  const selectedCount = rules.filter((rule) =>
    selectedRuleIds.includes(rule.id)
  ).length;

  const summaryText = isLoading && !data
    ? "Loading prompts…"
    : rules.length === 0
      ? "No prompts available"
      : selectedCount === rules.length
        ? "All prompts selected"
        : `${rules.length - selectedCount} more available`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Tag size={14} />
        {label} ({selectedRuleIds.length})
      </div>

      <details className="group border rounded-md">
        <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <span className="text-sm font-medium">{summaryText}</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="p-3 pt-0">
          {isLoading && !data ? (
            <RuleListSkeleton count={1} />
          ) : rules.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No prompts available for this directory
            </p>
          ) : (
            <>
              <VirtualizedList
                items={rules}
                scrollMode="container"
                containerClassName="max-h-[200px]"
                estimateSize={72}
                gap={8}
                renderItem={(rule) => (
                  <Checkbox
                    checked={selectedRuleIds.includes(rule.id)}
                    onChange={() => {
                      void handleToggle(rule.id);
                    }}
                    disabled={savingRuleIds.includes(rule.id)}
                    className="flex w-full items-start gap-2 p-2 rounded-md hover:bg-foreground/[0.07] transition-colors"
                    label={
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{rule.name}</span>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {rule.description}
                          </p>
                        )}
                      </div>
                    }
                  />
                )}
              />
              <p className="pt-2 text-xs text-muted-foreground">
                Your choice is remembered for this folder.
              </p>
            </>
          )}
        </div>
      </details>
    </div>
  );
};
