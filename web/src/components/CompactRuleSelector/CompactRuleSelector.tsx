import { useEffect, useMemo } from "react";
import { RotateCcw, Tag } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useGetApplicableRulesQuery } from "../../store/api/Rules/rulesApi";
import { RuleListSkeleton } from "../LoadingSkeletons";
import { ICompactRuleSelector } from "./ICompactRuleSelector";

/**
 * Compact Rule Selector Component
 * 
 * A streamlined version of RuleSelector designed for inline use in forms
 * Shows selected rules as chips and provides a collapsible list
 */
export const CompactRuleSelector = ({
  directoryId,
  operation,
  selectedRuleIds,
  onSelectionChange,
  label = "Rules",
  showResetButton = true,
}: ICompactRuleSelector) => {
  const { data, isLoading } = useGetApplicableRulesQuery({
    directoryId,
    operation,
  });

  const rules = data?.rules || [];
  const defaultRuleIds = useMemo(() => data?.defaultRuleIds || [], [data?.defaultRuleIds]);

  // Initialize with default rules on first load
  useEffect(() => {
    if (selectedRuleIds.length === 0 && defaultRuleIds.length > 0) {
      onSelectionChange(defaultRuleIds);
    }
  }, [defaultRuleIds, selectedRuleIds.length, onSelectionChange]);

  const handleToggle = (ruleId: string) => {
    if (selectedRuleIds.includes(ruleId)) {
      onSelectionChange(selectedRuleIds.filter((id) => id !== ruleId));
    } else {
      onSelectionChange([...selectedRuleIds, ruleId]);
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

      {/* Selected Rules as Chips */}
      {selectedRules.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md">
          {selectedRules.map((rule) => (
            <Badge
              key={rule.id}
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => handleToggle(rule.id)}
            >
              {rule.name}
              <span className="ml-1 text-muted-foreground hover:text-foreground">×</span>
            </Badge>
          ))}
        </div>
      )}

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
        
        <div className="p-3 pt-0 space-y-2 max-h-[200px] overflow-y-auto">
          {rules.map((rule) => (
            <label
              key={rule.id}
              className="flex items-start gap-2 cursor-pointer hover:bg-accent p-2 rounded-md transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedRuleIds.includes(rule.id)}
                onChange={() => handleToggle(rule.id)}
                className="w-4 h-4 mt-0.5 rounded border-border flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{rule.name}</span>
                  {rule.isDefault && (
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
            </label>
          ))}
        </div>
      </details>
    </div>
  );
};
