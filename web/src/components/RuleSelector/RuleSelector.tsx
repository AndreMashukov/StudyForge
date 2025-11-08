import { useEffect, useMemo } from "react";
import { RotateCcw, Settings } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useGetApplicableRulesQuery } from "../../store/api/Rules/rulesApi";
import { RuleListSkeleton } from "../LoadingSkeletons";
import { IRuleSelector } from "./IRuleSelector";
import { cn } from "../../lib/utils";

export const RuleSelector = ({
  directoryId,
  operation,
  selectedRuleIds,
  onSelectionChange,
  compact = false,
}: IRuleSelector) => {
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
      <div className={cn("border rounded-lg", compact ? "p-3" : "p-4")}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">📋 Rules</h3>
        </div>
        <RuleListSkeleton count={compact ? 2 : 3} />
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg", compact ? "p-3" : "p-4")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <span role="img" aria-label="rules">📋</span> Rules ({selectedRuleIds.length})
        </h3>
        <Button variant="ghost" size="sm" className="h-auto p-1">
          <Settings size={14} />
        </Button>
      </div>

      {/* Selected Rules Chips */}
      {selectedRules.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b">
          {selectedRules.map((rule) => (
            <Badge
              key={rule.id}
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => handleToggle(rule.id)}
            >
              {rule.name}
              <span className="ml-1">×</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {rules.length > 0 ? (
          rules.map((rule) => (
            <label
              key={rule.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded-md transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedRuleIds.includes(rule.id)}
                onChange={() => handleToggle(rule.id)}
                className="w-4 h-4 rounded border-border"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{rule.name}</span>
                  {rule.isDefault && (
                    <Badge variant="outline" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                {rule.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rule.description}
                  </p>
                )}
              </div>
            </label>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            <span role="img" aria-label="info">📭</span> No rules available for this operation
          </p>
        )}
      </div>

      {/* Reset Button */}
      {rules.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full"
          >
            <RotateCcw size={14} className="mr-1" />
            Reset to Defaults
          </Button>
        </div>
      )}
    </div>
  );
};
