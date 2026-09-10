import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { useTheme } from '../../../../contexts/ThemeContext';
import { useDirectoryRulesPage } from '../../context/DirectoryRulesPageContext';
import { useGetRulesQuery, useAttachRuleToDirectoryMutation } from '../../../../store/api/Rules';
import { Spinner } from '../../../../components/ui/Spinner';
import { Checkbox } from '../../../../components/ui/Checkbox';

interface AssignRuleModalProps {
  onClose: () => void;
}

export const AssignRuleModal = ({ onClose }: AssignRuleModalProps) => {
  const { currentTheme } = useTheme();
  const { state } = useDirectoryRulesPage();
  const { data: allRules = [], isLoading } = useGetRulesQuery();
  const [attachRule, { isLoading: isAttaching }] = useAttachRuleToDirectoryMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [hideAssigned, setHideAssigned] = useState(true);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allRules.forEach((rule) => rule.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [allRules]);

  const assignedRuleIds = useMemo(() => {
    return new Set(state.directRules.map((r) => r.id));
  }, [state.directRules]);

  const filteredRules = useMemo(() => {
    return allRules.filter((rule) => {
      const matchesSearch =
        !searchQuery ||
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => rule.tags.includes(tag));

      const matchesAssigned = !hideAssigned || !assignedRuleIds.has(rule.id);

      return matchesSearch && matchesTags && matchesAssigned;
    });
  }, [allRules, searchQuery, selectedTags, hideAssigned, assignedRuleIds]);

  const handleToggleRule = (ruleId: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAssignSelected = async () => {
    if (!state.directoryId || selectedRuleIds.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedRuleIds).map((ruleId) =>
          attachRule({
            ruleId,
            directoryId: state.directoryId,
          }).unwrap()
        )
      );

      onClose();
    } catch (error) {
      console.error('Failed to assign rules:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle>
            Assign Rules to Directory: {state.directory?.name || ''}
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-3">
          <Input
            type="text"
            placeholder="Search by name or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search rules by name or tags"
          />

          {allTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Filter by tags</p>
                {selectedTags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTags([])}
                    className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div
                className="h-32 overflow-y-auto overscroll-contain rounded-md border border-border p-2"
                aria-label="Tag filters"
              >
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className="rounded-md px-3 py-1 text-sm transition-colors"
                      style={{
                        backgroundColor: selectedTags.includes(tag)
                          ? currentTheme.colors.primary
                          : currentTheme.colors.secondary,
                        color: selectedTags.includes(tag)
                          ? currentTheme.colors.primaryForeground
                          : currentTheme.colors.secondaryForeground,
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Checkbox
            checked={hideAssigned}
            onChange={setHideAssigned}
            label="Hide already assigned"
          />
        </div>

        <DialogBody className="min-h-0 overflow-y-auto overscroll-contain rounded-lg border border-border">
          {isLoading ? (
            <div className="p-8 text-center">
              <Spinner size="md" variant="muted" className="mx-auto" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No rules found matching your criteria.
            </div>
          ) : (
            filteredRules.map((rule) => {
              const isAssigned = assignedRuleIds.has(rule.id);
              const isSelected = selectedRuleIds.has(rule.id);

              return (
                <div
                  key={rule.id}
                  className="flex cursor-pointer items-start gap-3 border-b border-border p-4 last:border-b-0 hover:bg-accent/30"
                  style={{
                    backgroundColor: isSelected
                      ? currentTheme.colors.accent
                      : undefined,
                  }}
                  onClick={() => {
                    if (!isAssigned) handleToggleRule(rule.id);
                  }}
                >
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleToggleRule(rule.id)}
                      disabled={isAssigned}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      {isAssigned && (
                        <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                          Already assigned
                        </span>
                      )}
                    </div>

                    <div className="mb-1 flex flex-wrap gap-1">
                      {rule.applicableTo.map((app) => (
                        <span
                          key={app}
                          className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {app}
                        </span>
                      ))}
                    </div>

                    {rule.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {rule.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </DialogBody>

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-sm font-medium">
            Selected: {selectedRuleIds.size} rule{selectedRuleIds.size !== 1 ? 's' : ''}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignSelected}
              disabled={selectedRuleIds.size === 0 || isAttaching}
            >
              {isAttaching
                ? 'Assigning...'
                : `Assign Selected Rule${selectedRuleIds.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
