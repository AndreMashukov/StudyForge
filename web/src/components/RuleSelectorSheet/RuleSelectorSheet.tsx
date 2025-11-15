import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { RuleSelector } from "../RuleSelector";
import { IRuleSelector } from "../RuleSelector/IRuleSelector";
import { cn } from "../../lib/utils";

interface IRuleSelectorSheet extends IRuleSelector {
  open: boolean;
  onClose: () => void;
}

export const RuleSelectorSheet = ({
  open,
  onClose,
  directoryId,
  operation,
  selectedRuleIds,
  onSelectionChange,
}: IRuleSelectorSheet) => {
  const [tempSelection, setTempSelection] = useState(selectedRuleIds);

  const handleApply = () => {
    onSelectionChange(tempSelection);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-lg",
          "max-h-[80vh] overflow-y-auto",
          "md:hidden",
          "animate-slide-up"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Select Rules</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <RuleSelector
            directoryId={directoryId}
            operation={operation}
            selectedRuleIds={tempSelection}
            onSelectionChange={setTempSelection}
            compact={true}
          />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t p-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply ({tempSelection.length})
          </Button>
        </div>
      </div>
    </>
  );
};
