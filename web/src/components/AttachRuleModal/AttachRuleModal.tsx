import { useState, useMemo } from "react";
import { Search, Plus, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import {
  useGetRulesQuery,
  useAttachRuleToDirectoryMutation,
} from "../../store/api/Rules/rulesApi";
import { IAttachRuleModal } from "./IAttachRuleModal";
import { Rule, RuleApplicability } from "@shared-types";
import { cn } from "../../lib/utils";

export const AttachRuleModal = ({
  directory,
  open,
  onClose,
  onCreateNew,
}: IAttachRuleModal) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [filterApplicability, setFilterApplicability] =
    useState<RuleApplicability | null>(null);

  const { data: allRules, isLoading } = useGetRulesQuery(undefined, {
    skip: !open,
  });

  const [attachRule, { isLoading: isAttaching }] =
    useAttachRuleToDirectoryMutation();

  // Filter out rules already attached to this directory
  const availableRules = useMemo(() => {
    if (!allRules) return [];

    return allRules.filter(
      (rule) =>
        !rule.directoryIds.includes(directory.id) &&
        (filterApplicability
          ? rule.applicableTo.includes(filterApplicability)
          : true) &&
        (searchQuery
          ? rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rule.tags.some((tag) =>
              tag.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : true)
    );
  }, [allRules, directory.id, searchQuery, filterApplicability]);

  const handleToggleSelection = (ruleId: string) => {
    setSelectedRuleIds((prev) =>
      prev.includes(ruleId)
        ? prev.filter((id) => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  const handleAttach = async () => {
    try {
      for (const ruleId of selectedRuleIds) {
        await attachRule({
          ruleId,
          directoryId: directory.id,
        }).unwrap();
      }
      setSelectedRuleIds([]);
      onClose();
    } catch (error) {
      console.error("Failed to attach rules:", error);
    }
  };

  const getApplicabilityBadges = (applicableTo: RuleApplicability[]) => {
    const badgeColors: Record<RuleApplicability, string> = {
      [RuleApplicability.SCRAPING]: "bg-blue-500/10 text-blue-500",
      [RuleApplicability.UPLOAD]: "bg-green-500/10 text-green-500",
      [RuleApplicability.PROMPT]: "bg-purple-500/10 text-purple-500",
      [RuleApplicability.QUIZ]: "bg-orange-500/10 text-orange-500",
      [RuleApplicability.FOLLOWUP]: "bg-pink-500/10 text-pink-500",
    };

    return applicableTo.map((op) => (
      <Badge
        key={op}
        variant="outline"
        className={cn("text-xs", badgeColors[op])}
      >
        {op}
      </Badge>
    ));
  };

  const getColorIndicator = (color: string) => {
    const colorClasses: Record<string, string> = {
      red: "bg-red-500",
      orange: "bg-orange-500",
      yellow: "bg-yellow-500",
      green: "bg-green-500",
      blue: "bg-blue-500",
      indigo: "bg-indigo-500",
      purple: "bg-purple-500",
      pink: "bg-pink-500",
      gray: "bg-gray-500",
    };

    return (
      <div
        className={cn(
          "w-3 h-3 rounded-full",
          colorClasses[color] || "bg-gray-500"
        )}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader onClose={onClose}>
          <DialogTitle>Attach Rules to {directory.name}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select rules to attach to this directory
          </p>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search rules by name or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Add filter dropdown
                console.log("Toggle filter");
              }}
            >
              <Filter size={16} />
            </Button>
          </div>

          {/* Create New Rule Button */}
          <div className="border border-dashed border-border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">Can't find the right rule?</p>
              <p className="text-sm text-muted-foreground">
                Create a new rule and attach it to this directory
              </p>
            </div>
            <Button variant="outline" onClick={onCreateNew}>
              <Plus size={16} className="mr-1" />
              Create New
            </Button>
          </div>

          {/* Rules List */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Loading rules...
            </div>
          ) : availableRules.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {availableRules.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => handleToggleSelection(rule.id)}
                  className={cn(
                    "w-full text-left border rounded-lg p-3 space-y-2 transition-colors",
                    selectedRuleIds.includes(rule.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getColorIndicator(rule.color)}
                      <span className="font-medium">{rule.name}</span>
                      {selectedRuleIds.includes(rule.id) && (
                        <Badge variant="default" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                  </div>

                  {rule.description && (
                    <p className="text-sm text-muted-foreground">
                      {rule.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {getApplicabilityBadges(rule.applicableTo)}
                  </div>

                  {rule.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">🏷️</span>
                      {rule.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
              {searchQuery || filterApplicability
                ? "No rules match your search criteria"
                : "No rules available to attach"}
            </div>
          )}

          {/* Selection Summary */}
          {selectedRuleIds.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium">
                {selectedRuleIds.length} rule(s) selected
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAttach}
            disabled={selectedRuleIds.length === 0 || isAttaching}
          >
            {isAttaching
              ? "Attaching..."
              : `Attach ${selectedRuleIds.length > 0 ? `(${selectedRuleIds.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
