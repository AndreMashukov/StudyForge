import { useState } from "react";
import { Star, MoreVertical, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/DropdownMenu";
import {
  useGetDirectoryRulesQuery,
  useDetachRuleFromDirectoryMutation,
  useUpdateRuleMutation,
} from "../../store/api/Rules/rulesApi";
import { AttachRuleModal } from "../AttachRuleModal";
import { RuleFormModal } from "../RuleFormModal";
import { useToast } from "../Toast";
import { IDirectorySettingsModal } from "./IDirectorySettingsModal";
import { Rule, RuleApplicability } from "@shared-types";
import { cn } from "../../lib/utils";

export const DirectorySettingsModal = ({
  directory,
  open,
  onClose,
}: IDirectorySettingsModal) => {
  const { showToast } = useToast();
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [createRuleModalOpen, setCreateRuleModalOpen] = useState(false);

  // Fetch rules directly attached to this directory (not cascading)
  const { data: rulesData, isLoading } = useGetDirectoryRulesQuery(
    {
      directoryId: directory.id,
      includeAncestors: false,
    },
    { skip: !open }
  );

  const [detachRule, { isLoading: isDetaching }] =
    useDetachRuleFromDirectoryMutation();
  const [updateRule, { isLoading: isUpdating }] = useUpdateRuleMutation();

  const handleDetach = async (ruleId: string, ruleName: string) => {
    try {
      await detachRule({
        ruleId,
        directoryId: directory.id,
      }).unwrap();
      showToast(`Rule "${ruleName}" detached from "${directory.name}"`, "success");
    } catch (error) {
      console.error("Failed to detach rule:", error);
      showToast("Failed to detach rule. Please try again.", "error");
    }
  };

  const handleToggleDefault = async (rule: Rule) => {
    try {
      await updateRule({
        ruleId: rule.id,
        isDefault: !rule.isDefault,
      }).unwrap();
      showToast(
        `Rule "${rule.name}" ${!rule.isDefault ? "set as" : "removed from"} default`,
        "success"
      );
    } catch (error) {
      console.error("Failed to toggle default:", error);
      showToast("Failed to update default status. Please try again.", "error");
    }
  };

  const handleEditRule = (ruleId: string) => {
    setEditRuleId(ruleId);
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
        className={cn("w-3 h-3 rounded-full", colorClasses[color] || "bg-gray-500")}
      />
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
        <DialogHeader onClose={onClose}>
          <DialogTitle>📁 Directory Settings: {directory.name}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Path: {directory.path}
          </p>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Directory Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Directory Name</h3>
            </div>
            <p className="text-sm text-muted-foreground">{directory.name}</p>
          </div>

          <div className="border-t border-border my-4" />

          {/* Rules Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                📋 Rules ({rulesData?.rules.length || 0} attached)
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAttachModalOpen(true)}
              >
                <Plus size={16} className="mr-1" />
                Attach Rule
              </Button>
            </div>

            {/* Rules List */}
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading rules...</div>
            ) : rulesData?.rules && rulesData.rules.length > 0 ? (
              <div className="space-y-3">
                {rulesData.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="border border-border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getColorIndicator(rule.color)}
                        <div className="flex items-center gap-2">
                          {rule.isDefault && (
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                          )}
                          <span className="font-medium">{rule.name}</span>
                        </div>
                        {rule.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => console.log("View details:", rule.id)}
                          >
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditRule(rule.id)}
                          >
                            Edit Rule
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleDefault(rule)}
                            disabled={isUpdating}
                          >
                            {rule.isDefault ? "Remove Default" : "Set as Default"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDetach(rule.id, rule.name)}
                            disabled={isDetaching}
                            className="text-destructive"
                          >
                            Detach from Directory
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Rule Description */}
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">
                        {rule.description}
                      </p>
                    )}

                    {/* Applicability Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {getApplicabilityBadges(rule.applicableTo)}
                    </div>

                    {/* Tags */}
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
                No rules attached to this directory yet.
                <br />
                Click "Attach Rule" to add rules.
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Attach Rule Modal */}
      <AttachRuleModal
        directory={directory}
        open={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        onCreateNew={() => {
          setAttachModalOpen(false);
          setCreateRuleModalOpen(true);
        }}
      />

      {/* Edit Rule Modal */}
      {editRuleId && (
        <RuleFormModal
          ruleId={editRuleId}
          open={!!editRuleId}
          onClose={() => setEditRuleId(null)}
          onSuccess={() => {
            setEditRuleId(null);
            // Rules will auto-refresh via RTK Query cache invalidation
          }}
        />
      )}

      {/* Create New Rule Modal */}
      <RuleFormModal
        open={createRuleModalOpen}
        onClose={() => setCreateRuleModalOpen(false)}
        onSuccess={() => {
          setCreateRuleModalOpen(false);
          // Rules will auto-refresh via RTK Query cache invalidation
        }}
      />
    </>
  );
};
