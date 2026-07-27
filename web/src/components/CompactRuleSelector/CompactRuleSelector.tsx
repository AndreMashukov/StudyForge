import { useEffect, useMemo, useRef } from "react";
import { RotateCcw, Tag } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Checkbox } from "../ui/Checkbox";
import {
  useGetApplicableRulesQuery,
  useUpdateRuleMutation,
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
  label = "Rules",
  showResetButton = true,
}: ICompactRuleSelector) => {
  const { data, isLoading, isSuccess } = useGetApplicableRulesQuery({
    directoryId,
    operation,
  });
  const [updateRule] = useUpdateRuleMutation();
  const initializedKeyRef = useRef<string | null>(null);
  const selectionKey = `${directoryId}:${operation}`;

  const rules = data?.rules || [];
  const defaultRuleIds = useMemo(() => data?.defaultRuleIds || [], [data?.defaultRuleIds]);

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

  const handleToggle = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (selectedRuleIds.includes(ruleId)) {
      onSelectionChange(selectedRuleIds.filter((id) => id !== ruleId));
      if (rule?.isDefault) {
        void updateRule({ ruleId, isDefault: false });
      }
    } else {
      onSelectionChange([...selectedRuleIds, ruleId]);
      if (rule && !rule.isDefault) {
        void updateRule({ ruleId, isDefault: true });
      }
    }
  };

  const handleReset = () => {
    onSelectionChange(defaultRuleIds);
  };

  const selectedRules = rules.filter((rule) =>
    selectedRuleIds.includes(rule.id)
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Tag size={14} />
          {label}
        </div>
        <RuleListSkeleton count={1} />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Tag size={14} />
          {label}
        </div>
        <p className="text-xs text-muted-foreground">
          No rules available for this directory
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Tag size={14} />
          {label} ({selectedRuleIds.length})
        </div>
        {showResetButton && rules.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-auto p-1 text-xs"
          >
            <RotateCcw size={12} className="mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Compact Rules List */}
      <details className="group border rounded-md">
        <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <span className="text-sm font-medium">
            {selectedRules.length === rules.length 
              ? "All rules selected" 
              : `${rules.length - selectedRules.length} more available`}
          </span>
          <span className="transition-transform group-open:rotate-180">▼</span>
        </summary>
        
        <div className="p-3 pt-0">
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
                className="flex w-full items-start gap-2 p-2 rounded-md hover:bg-accent transition-colors"
                label={
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{rule.name}</span>
                      {rule.isDefault && (
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
        </div>
      </details>
    </div>
  );
};
