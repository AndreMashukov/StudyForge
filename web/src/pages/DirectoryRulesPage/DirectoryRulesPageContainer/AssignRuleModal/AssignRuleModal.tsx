import { useState, useMemo } from 'react';
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
import { VirtualizedList } from '../../../../components/VirtualizedList';

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

  // Get all unique tags from all rules
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allRules.forEach((rule) => rule.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [allRules]);

  // Get IDs of rules already assigned to this directory
  const assignedRuleIds = useMemo(() => {
    return new Set(state.directRules.map((r) => r.id));
  }, [state.directRules]);

  // Filter rules based on search and tags
  const filteredRules = useMemo(() => {
    return allRules.filter((rule) => {
      // Search filter
      const matchesSearch = 
        !searchQuery ||
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      // Tag filter
      const matchesTags = 
        selectedTags.length === 0 ||
        selectedTags.some((tag) => rule.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  }, [allRules, searchQuery, selectedTags]);

  const handleToggleRule = (ruleId: string) => {
    setSelectedRuleIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
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
      // Attach each selected rule to the directory
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign Rules to Directory: {state.directory?.name || ''}
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-3">
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: currentTheme.colors.foreground }}
            >
              Filter by tags:
            </label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
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
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="rounded-md px-3 py-1 text-sm"
                  style={{
                    backgroundColor: currentTheme.colors.muted,
                    color: currentTheme.colors.mutedForeground,
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <Input
            type="text"
            placeholder="🔍 Search by name or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <DialogBody className="flex flex-col overflow-hidden">
          <div
            className="min-h-0 max-h-full flex-1 overflow-hidden rounded-lg border"
            style={{ borderColor: currentTheme.colors.border }}
          >
            {isLoading ? (
              <div className="p-8 text-center">
                <Spinner size="md" variant="muted" className="mx-auto" />
              </div>
            ) : filteredRules.length === 0 ? (
              <div
                className="p-8 text-center"
                style={{ color: currentTheme.colors.mutedForeground }}
              >
                No rules found matching your criteria.
              </div>
            ) : (
              <VirtualizedList
                items={filteredRules}
                scrollMode="container"
                className="h-full min-h-0"
                containerClassName="h-full"
                estimateSize={96}
                renderItem={(rule) => {
                  const isAssigned = assignedRuleIds.has(rule.id);
                  const isSelected = selectedRuleIds.has(rule.id);

                  return (
                    <div
                      className="flex cursor-pointer items-start gap-3 border-b p-4 last:border-b-0 hover:bg-opacity-50"
                      style={{
                        borderColor: currentTheme.colors.border,
                        backgroundColor: isSelected
                          ? currentTheme.colors.accent
                          : 'transparent',
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
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className="font-medium"
                            style={{ color: currentTheme.colors.foreground }}
                          >
                            {rule.name}
                          </span>
                          {isAssigned && (
                            <span
                              className="rounded px-2 py-0.5 text-xs"
                              style={{
                                backgroundColor: currentTheme.colors.primary,
                                color: currentTheme.colors.primaryForeground,
                              }}
                            >
                              Already assigned ✓
                            </span>
                          )}
                        </div>

                        <div className="mb-1 flex flex-wrap gap-1">
                          {rule.applicableTo.map((app) => (
                            <span
                              key={app}
                              className="rounded px-2 py-0.5 text-xs"
                              style={{
                                backgroundColor: currentTheme.colors.secondary,
                                color: currentTheme.colors.secondaryForeground,
                              }}
                            >
                              {app}
                            </span>
                          ))}
                        </div>

                        {rule.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className="text-xs"
                              style={{ color: currentTheme.colors.mutedForeground }}
                            >
                              <span role="img" aria-label="tags">
                                🏷️
                              </span>
                            </span>
                            {rule.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs"
                                style={{ color: currentTheme.colors.mutedForeground }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </div>
        </DialogBody>

        <div
          className="shrink-0 rounded-md p-3 text-sm"
          style={{
            backgroundColor: currentTheme.colors.muted,
            color: currentTheme.colors.mutedForeground,
          }}
        >
          <span role="img" aria-label="info">
            ℹ️
          </span>{' '}
          Note: Rules already inherited from parent directories are not shown here.
        </div>

        <div
          className="shrink-0 text-sm font-medium"
          style={{ color: currentTheme.colors.foreground }}
        >
          Selected: {selectedRuleIds.size} rule{selectedRuleIds.size !== 1 ? 's' : ''}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignSelected}
            disabled={selectedRuleIds.size === 0 || isAttaching}
          >
            {isAttaching ? 'Assigning...' : `Assign Selected Rule${selectedRuleIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
