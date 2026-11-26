import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Pin, RotateCcw, Tag } from "lucide-react";
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
 * Prompt picker for one creation. It opens with the folder's default prompts
 * ticked (always apply, ADR 016). Ticking and unticking only changes this
 * creation; "Save as default" stores the current choice for the folder.
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
  const [setRuleAlwaysApply] = useSetRuleAlwaysApplyMutation();
  const [isUpdating, setIsUpdating] = useState(false);
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

  // Start from the folder's default prompts once per directory/operation
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

  const handleToggle = (ruleId: string) => {
    if (isRulesInteractionDisabled) {
      return;
    }
    // One-off: this changes only what is being created now.
    onSelectionChange(
      selectedRuleIds.includes(ruleId)
        ? selectedRuleIds.filter((id) => id !== ruleId)
        : [...selectedRuleIds, ruleId],
    );
  };

  const defaultRuleIdSet = useMemo(() => new Set(defaultRuleIds), [defaultRuleIds]);
  const changedRules = rules.filter(
    (rule) => selectedRuleIds.includes(rule.id) !== defaultRuleIdSet.has(rule.id),
  );

  // Stores the current choice as this folder's defaults (subfolders follow).
  const handleSaveAsDefault = async () => {
    if (isRulesInteractionDisabled || changedRules.length === 0) {
      return;
    }
    setIsUpdating(true);
    try {
      for (const rule of changedRules) {
        await setRuleAlwaysApply({
          ruleId: rule.id,
          directoryId,
          alwaysApply: selectedRuleIds.includes(rule.id),
        }).unwrap();
      }
    } catch {
      // Error is shown via the global errorToastMiddleware toast
    } finally {
      setIsUpdating(false);
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
        <div className="flex items-center gap-1">
          {changedRules.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleSaveAsDefault();
              }}
              disabled={isRulesInteractionDisabled}
              title="Use this choice by default in this folder and its subfolders"
              className="h-auto p-1 text-xs"
            >
              <Pin size={12} className="mr-1" />
              Save as default
            </Button>
          )}
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
                  onChange={() => handleToggle(rule.id)}
                  disabled={isRulesInteractionDisabled}
                  className="flex w-full items-start gap-2 p-2 rounded-md hover:bg-foreground/[0.07] transition-colors"
                  label={
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{rule.name}</span>
                        {defaultRuleIdSet.has(rule.id) && (
                          <Badge variant="outline" className="text-xs">
                            Default
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
