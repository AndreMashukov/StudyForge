import { useEffect, useMemo, useRef } from "react";
import { ruleAlwaysAppliesIn } from "@shared-types";
import { ChevronDown, RotateCcw, Tag } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Checkbox } from "../ui/Checkbox";
import {
  useGetApplicableRulesQuery,
  useSetRuleAlwaysApplyMutation,
} from "../../store/api/Rules/rulesApi";
import { RuleListSkeleton } from "../LoadingSkeletons";
import { VirtualizedList } from "../VirtualizedList";
import { ICompactRuleSelector } from "./ICompactRuleSelector";

/**
 * Compact Rule Selector Component
 *
 * A streamlined version of RuleSelector designed for inline use in forms
 * Provides a collapsible checklist of applicable rules
 */
export const CompactRuleSelector = ({
  directoryId,
  operation,
  selectedRuleIds,
  onSelectionChange,
  label = "Prompts",
  showResetButton = true,
  controlsDisabled = false,
  onBusyChange,
}: ICompactRuleSelector) => {
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

  const handleReset = () => {
    if (isRulesInteractionDisabled) {
      return;
    }
    onSelectionChange(defaultRuleIds);
  };

  const selectedRules = rules.filter((rule) =>
    selectedRuleIds.includes(rule.id)
  );

  const summaryText = isLoading && !data
    ? "Loading prompts…"
    : rules.length === 0
      ? "No prompts available"
      : selectedRules.length === rules.length
        ? "All prompts selected"
        : `${rules.length - selectedRules.length} more available`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Tag size={14} />
          {label} ({selectedRuleIds.length})
        </div>
        {showResetButton && (rules.length > 0 || (isLoading && !data)) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isRulesInteractionDisabled || rules.length === 0}
            className="h-auto p-1 text-xs"
          >
            <RotateCcw size={12} className="mr-1" />
            Reset
          </Button>
        )}
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
                  disabled={isRulesInteractionDisabled}
                  className="flex w-full items-start gap-2 p-2 rounded-md hover:bg-foreground/[0.07] transition-colors"
                  label={
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{rule.name}</span>
                        {ruleAlwaysAppliesIn(rule, directoryId) && (
                          <Badge variant="outline" className="text-xs">
                            Always apply
                          </Badge>
                        )}
                      </div>
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
          )}
        </div>
      </details>
    </div>
  );
};
