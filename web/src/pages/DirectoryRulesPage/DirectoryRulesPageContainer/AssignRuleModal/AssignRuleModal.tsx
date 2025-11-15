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
        
        <DialogBody>
          <div className="space-y-4">
        {/* Search and Filter */}
        <div className="space-y-3">
          {/* Tag Filter Dropdown */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: currentTheme.colors.foreground }}
            >
              Filter by tags:
            </label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  className="px-3 py-1 rounded-md text-sm transition-colors"
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
                  className="px-3 py-1 rounded-md text-sm"
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

          {/* Search Input */}
          <Input
            type="text"
            placeholder="🔍 Search by name or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Rules List */}
        <div 
          className="border rounded-lg max-h-96 overflow-y-auto"
          style={{ borderColor: currentTheme.colors.border }}
        >
          {isLoading ? (
            <div className="p-8 text-center">
              <div 
                className="animate-spin rounded-full h-8 w-8 border-4 mx-auto"
                style={{ 
                  borderColor: currentTheme.colors.muted,
                  borderTopColor: currentTheme.colors.primary,
                }}
              ></div>
            </div>
          ) : filteredRules.length === 0 ? (
            <div 
              className="p-8 text-center"
              style={{ color: currentTheme.colors.mutedForeground }}
            >
              No rules found matching your criteria.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: currentTheme.colors.border }}>
              {filteredRules.map((rule) => {
                const isAssigned = assignedRuleIds.has(rule.id);
                const isSelected = selectedRuleIds.has(rule.id);

                return (
                  <label
                    key={rule.id}
                    className="flex items-start gap-3 p-4 hover:bg-opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? currentTheme.colors.accent
                        : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleRule(rule.id)}
                      disabled={isAssigned}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className="font-medium"
                          style={{ color: currentTheme.colors.foreground }}
                        >
                          {rule.name}
                        </span>
                        {isAssigned && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ 
                              backgroundColor: currentTheme.colors.primary,
                              color: currentTheme.colors.primaryForeground,
                            }}
                          >
                            Already assigned ✓
                          </span>
                        )}
                      </div>
                      
                      {/* Applicability badges */}
                      <div className="flex flex-wrap gap-1 mb-1">
                        {rule.applicableTo.map((app) => (
                          <span
                            key={app}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: currentTheme.colors.secondary,
                              color: currentTheme.colors.secondaryForeground,
                            }}
                          >
                            {app}
                          </span>
                        ))}
                      </div>

                      {/* Tags */}
                      {rule.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
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
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Note */}
        <div 
          className="text-sm p-3 rounded-md"
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

        {/* Selected Count */}
        <div 
          className="text-sm font-medium"
          style={{ color: currentTheme.colors.foreground }}
        >
          Selected: {selectedRuleIds.size} rule{selectedRuleIds.size !== 1 ? 's' : ''}
        </div>

        {/* Actions */}
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
      </div>
      </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
