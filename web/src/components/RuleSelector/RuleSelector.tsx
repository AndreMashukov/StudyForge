import { useEffect, useMemo, useRef } from "react";
import { ruleAlwaysAppliesIn } from "@shared-types";
import { ClipboardList, Inbox } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Checkbox } from "../ui/Checkbox";
import {
  useGetApplicableRulesQuery,
  useSetRuleAlwaysApplyMutation,
} from "../../store/api/Rules/rulesApi";
import { RuleListSkeleton } from "../LoadingSkeletons";
import { VirtualizedList } from "../VirtualizedList";
import { IRuleSelector } from "./IRuleSelector";
import { cn } from "../../lib/utils";

export const RuleSelector = ({
  directoryId,
  operation,
  selectedRuleIds,
  onSelectionChange,
  title = "Prompts",
  compact = false,
  controlsDisabled = false,
  onBusyChange,
}: IRuleSelector) => {
  const { data, isLoading, isSuccess, isFetching } = useGetApplicableRulesQuery({
    directoryId,
    operation,
  });
  const [setRuleAlwaysApply, { isLoading: isUpdating }] = useSetRuleAlwaysApplyMutation();
  const initializedKeyRef = useRef<string | null>(null);
  const selectionKey = `${directoryId}:${operation}`;

  const rules = data?.rules || [];
  const defaultRuleIds = useMemo(() => data?.defaultRuleIds || [], [data?.defaultRuleIds]);
  const isRulesInteractionDisabled =
    controlsDisabled || isLoading || isFetching || isUpdating;

  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    onBusyChangeRef.current?.(isUpdating);
    return () => {
      onBusyChangeRef.current?.(false);
    };
  }, [isUpdating]);

  // Initialize with always-apply rules once per directory/operation
  useEffect(() => {
    if (!isSuccess || initializedKeyRef.current === selectionKey) {
      return;
    }
    initializedKeyRef.current = selectionKey;
    if (selectedRuleIds.length === 0 && defaultRuleIds.length > 0) {
      onSelectionChange(defaultRuleIds);
    }
  }, [
    isSuccess,
    selectionKey,
    defaultRuleIds,
    selectedRuleIds.length,
    onSelectionChange,
  ]);

  const handleToggle = async (ruleId: string) => {
    if (isRulesInteractionDisabled) {
      return;
    }

    // Ticking a prompt here makes it always apply in this folder only, and
    // unticking stops it (ADR 015). Other folders keep their own setting.
    const rule = rules.find((r) => r.id === ruleId);
    const previousSelection = selectedRuleIds;
    const selecting = !selectedRuleIds.includes(ruleId);

    onSelectionChange(
      selecting
        ? [...selectedRuleIds, ruleId]
        : selectedRuleIds.filter((id) => id !== ruleId),
    );
    if (!rule || ruleAlwaysAppliesIn(rule, directoryId) === selecting) {
      return;
    }
    try {
      await setRuleAlwaysApply({
        ruleId,
        directoryId,
        alwaysApply: selecting,
      }).unwrap();
    } catch {
      onSelectionChange(previousSelection);
    }
  };

  return (
    <div className={cn("border rounded-lg", compact ? "p-3" : "p-4")}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
          {title} ({selectedRuleIds.length})
        </h3>
      </div>

      {isLoading && !data ? (
        <RuleListSkeleton count={compact ? 2 : 3} />
      ) : rules.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Inbox className="h-4 w-4 shrink-0" aria-hidden="true" />
          No prompts available for this operation
        </p>
      ) : (
        <VirtualizedList
          items={rules}
          scrollMode="container"
          containerClassName="max-h-[300px]"
          estimateSize={72}
          gap={8}
          renderItem={(rule) => (
            <Checkbox
              checked={selectedRuleIds.includes(rule.id)}
              onChange={() => {
                void handleToggle(rule.id);
              }}
              disabled={isRulesInteractionDisabled}
              className="flex w-full items-center gap-2 p-2 rounded-md hover:bg-foreground/[0.07] transition-colors"
              label={
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{rule.name}</span>
                    {ruleAlwaysAppliesIn(rule, directoryId) && (
                      <Badge variant="outline" className="text-xs">
                        Always apply
                      </Badge>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rule.description}
                    </p>
                  )}
                </div>
              }
            />
          )}
        />
      )}
    </div>
  );
};
