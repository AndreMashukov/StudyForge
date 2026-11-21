import { useMemo, useState } from 'react';
import { ChevronDown, Folder, Search, SlidersHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../../components/ui/Dialog';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Badge } from '../../../../components/ui/Badge';
import { useDirectoryRulesPage } from '../../context/DirectoryRulesPageContext';
import { useGetRulesQuery, useAttachRuleToDirectoryMutation } from '../../../../store/api/Rules';
import { Spinner } from '../../../../components/ui/Spinner';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { cn } from '../../../../lib/utils';

interface AssignRuleModalProps {
  onClose: () => void;
}

export const AssignRuleModal = ({ onClose }: AssignRuleModalProps) => {
  const { state } = useDirectoryRulesPage();
  const { data: allRules = [], isLoading } = useGetRulesQuery();
  const [attachRule, { isLoading: isAttaching }] = useAttachRuleToDirectoryMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [hideAssigned, setHideAssigned] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allRules.forEach((rule) => rule.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [allRules]);

  const assignedRuleIds = useMemo(() => {
    return new Set(state.directRules.map((r) => r.id));
  }, [state.directRules]);

  const filteredRules = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return allRules.filter((rule) => {
      const matchesSearch =
        !query ||
        rule.name.toLowerCase().includes(query) ||
        rule.tags.some((tag) => tag.toLowerCase().includes(query));

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

  const selectedCount = selectedRuleIds.size;
  const activeFilterCount = selectedTags.length;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="h-full max-w-4xl gap-0 p-0 sm:h-[min(720px,calc(100dvh-2rem))]">
        <DialogHeader className="border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Assign rules</DialogTitle>
          <DialogDescription className="flex min-w-0 items-center gap-1.5">
            <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{state.directory?.name || ''}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[260px_minmax(0,1fr)]">
          {/* Filters column (stacked above the list on small screens) */}
          <aside className="flex shrink-0 flex-col gap-3 border-b border-border p-4 md:min-h-0 md:border-b-0 md:border-r">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="Search rules"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search rules by name or tags"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-1.5 px-3 md:hidden"
                onClick={() => setIsFiltersOpen((open) => !open)}
                aria-expanded={isFiltersOpen}
                aria-controls="assign-rule-filters"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="px-1.5 py-0">{activeFilterCount}</Badge>
                )}
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', isFiltersOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </Button>
            </div>

            <div
              id="assign-rule-filters"
              className={cn(
                'min-h-0 flex-1 flex-col gap-3',
                isFiltersOpen ? 'flex' : 'hidden',
                'md:flex'
              )}
            >
              <Checkbox
                checked={hideAssigned}
                onChange={setHideAssigned}
                label="Hide already assigned"
              />

              {allTags.length > 0 && (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Tags
                    </p>
                    {selectedTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTags([])}
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Clear ({selectedTags.length})
                      </button>
                    )}
                  </div>
                  <div
                    className="max-h-36 overflow-y-auto overscroll-contain md:max-h-none md:min-h-0 md:flex-1"
                    role="group"
                    aria-label="Filter by tags"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map((tag) => {
                        const isActive = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleTag(tag)}
                            aria-pressed={isActive}
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
                            )}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Rule list column */}
          <section className="flex min-h-0 flex-1 flex-col" aria-label="Rules">
            <p className="shrink-0 px-4 pb-2 pt-3 text-xs text-muted-foreground sm:px-6">
              {isLoading
                ? 'Loading rules…'
                : `${filteredRules.length} rule${filteredRules.length !== 1 ? 's' : ''}`}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 sm:px-4">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Spinner size="md" variant="muted" className="mx-auto" />
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No rules found matching your criteria.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredRules.map((rule) => {
                    const isAssigned = assignedRuleIds.has(rule.id);
                    const isSelected = selectedRuleIds.has(rule.id);

                    return (
                      <li
                        key={rule.id}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                          isAssigned
                            ? 'cursor-default border-transparent opacity-60'
                            : 'cursor-pointer',
                          isSelected
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-transparent hover:bg-secondary/50'
                        )}
                        onClick={() => {
                          if (!isAssigned) handleToggleRule(rule.id);
                        }}
                      >
                        <span className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggleRule(rule.id)}
                            disabled={isAssigned}
                            aria-label={`Select ${rule.name}`}
                          />
                        </span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium leading-snug">{rule.name}</span>
                            {isAssigned && <Badge variant="secondary">Assigned</Badge>}
                          </div>

                          {rule.applicableTo.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {rule.applicableTo.map((app) => (
                                <Badge key={app} variant="outline" className="font-normal">
                                  {app}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {rule.tags.length > 0 && (
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {rule.tags.map((tag) => `#${tag}`).join('  ')}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        <DialogFooter className="flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:space-x-0 sm:px-6">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-medium text-foreground">{selectedCount}</span> selected
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignSelected}
              disabled={selectedCount === 0 || isAttaching}
            >
              {isAttaching
                ? 'Assigning…'
                : selectedCount > 0
                  ? `Assign ${selectedCount}`
                  : 'Assign'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
