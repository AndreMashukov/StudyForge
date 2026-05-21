import { RuleApplicability } from '@shared-types';
import { useRulesPageContext } from '../context/hooks/useRulesPageContext';
import { Page } from '../../../components/Page';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { RuleCard } from './RuleCard';
import { Checkbox } from '../../../components/ui/Checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../../components/ui/DropdownMenu';
import { Plus, Search, Grid3x3, List, Filter, ChevronDown, X } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { cn } from '../../../lib/utils';
import { Spinner } from '../../../components/ui/Spinner';
import { getRuleApplicabilityLabel } from '../../../utils/ruleApplicabilityUtils';

const ruleTypeOptions = Object.values(RuleApplicability);

const defaultFilters = {
  tags: [],
  applicableTo: [],
  colors: [],
  showDefaultOnly: false,
};

export const RulesPageContainer = () => {
  const {
    rulesApi,
    handlers,
    filters,
    viewMode,
    searchQuery,
    filteredRules,
  } = useRulesPageContext();
  
  const { currentTheme } = useTheme();

  const selectedRuleTypeCount = filters.applicableTo.length;
  const hasRuleTypeFilter = selectedRuleTypeCount > 0;

  const handleRuleTypeToggle = (ruleType: RuleApplicability) => {
    const nextApplicableTo = filters.applicableTo.includes(ruleType)
      ? filters.applicableTo.filter((selectedRuleType) => selectedRuleType !== ruleType)
      : [...filters.applicableTo, ruleType];

    handlers.handleFilterChange({
      ...filters,
      applicableTo: nextApplicableTo,
    });
  };

  const handleClearRuleTypes = () => {
    handlers.handleFilterChange({
      ...filters,
      applicableTo: [],
    });
  };

  const handleClearSearchAndFilters = () => {
    handlers.handleSearchChange('');
    handlers.handleFilterChange(defaultFilters);
  };

  // Loading state
  if (rulesApi.isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="md" />
            <p
              className="text-sm"
              style={{ color: currentTheme.colors.mutedForeground }}
            >
              Loading rules...
            </p>
          </div>
        </div>
      </Page>
    );
  }

  // Error state
  if (rulesApi.error) {
    return (
      <Page showSidebar={true}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div
            className="p-6 rounded-lg border text-center max-w-md"
            style={{
              backgroundColor: currentTheme.colors.card,
              borderColor: currentTheme.colors.destructive,
            }}
          >
            <p
              className="font-medium mb-2"
              style={{ color: currentTheme.colors.destructive }}
            >
              Failed to load rules
            </p>
            <p
              className="text-sm mb-4"
              style={{ color: currentTheme.colors.mutedForeground }}
            >
              {rulesApi.error instanceof Error
                ? rulesApi.error.message
                : 'An unknown error occurred'}
            </p>
            <Button
              onClick={() => rulesApi.refetch()}
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  const hasRules = (rulesApi.data?.length || 0) > 0;
  const hasFilteredRules = filteredRules.length > 0;

  return (
    <Page showSidebar={true}>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-bold font-heading"
              style={{ color: currentTheme.colors.foreground }}
            >
              Rules Manager
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: currentTheme.colors.mutedForeground }}
            >
              Create and manage AI behavior rules for your documents
            </p>
          </div>
          <Button onClick={handlers.handleCreateRule}>
            <Plus size={16} className="mr-2" />
            Create Rule
          </Button>
        </div>

        {/* Search and View Toggle */}
        {hasRules && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: currentTheme.colors.mutedForeground }}
              />
              <Input
                placeholder="Search rules by name, description, tags, or type..."
                value={searchQuery}
                onChange={(e) => handlers.handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-w-[132px] justify-between gap-2 px-3"
                    aria-label="Filter rules by type"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Filter size={16} className="flex-shrink-0" />
                      <span className="truncate">
                        {hasRuleTypeFilter
                          ? `${selectedRuleTypeCount} ${selectedRuleTypeCount === 1 ? 'type' : 'types'}`
                          : 'All types'}
                      </span>
                    </span>
                    <ChevronDown size={14} className="flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Rule Type
                    </span>
                    {hasRuleTypeFilter && (
                      <button
                        type="button"
                        onClick={handleClearRuleTypes}
                        className="text-xs font-medium text-primary hover:text-primary/80"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 space-y-1 overflow-y-auto p-1">
                    {ruleTypeOptions.map((ruleType) => (
                      <Checkbox
                        key={ruleType}
                        checked={filters.applicableTo.includes(ruleType)}
                        onChange={() => handleRuleTypeToggle(ruleType)}
                        label={getRuleApplicabilityLabel(ruleType)}
                        className="flex w-full rounded-sm px-2 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground"
                      />
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            
              <div
                className="flex rounded-lg border p-1"
                style={{
                  backgroundColor: currentTheme.colors.card,
                  borderColor: currentTheme.colors.border,
                }}
              >
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handlers.handleViewModeChange('grid')}
                  className="px-3"
                  aria-label="Show rules in grid view"
                >
                  <Grid3x3 size={16} />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handlers.handleViewModeChange('list')}
                  className="px-3"
                  aria-label="Show rules in list view"
                >
                  <List size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {hasRuleTypeFilter && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.applicableTo.map((ruleType) => (
              <Badge key={ruleType} variant="outline" className="gap-1.5 pr-1.5">
                {getRuleApplicabilityLabel(ruleType)}
                <button
                  type="button"
                  onClick={() => handleRuleTypeToggle(ruleType)}
                  aria-label={`Remove ${getRuleApplicabilityLabel(ruleType)} filter`}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={12} />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Empty State - No Rules */}
        {!hasRules && (
          <div
            className="text-center py-16 rounded-lg border"
            style={{
              backgroundColor: currentTheme.colors.card,
              borderColor: currentTheme.colors.border,
            }}
          >
            <div className="max-w-md mx-auto">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: currentTheme.colors.muted }}
              >
                <Plus
                  size={32}
                  style={{ color: currentTheme.colors.mutedForeground }}
                />
              </div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: currentTheme.colors.foreground }}
              >
                No rules yet
              </h3>
              <p
                className="text-sm mb-6"
                style={{ color: currentTheme.colors.mutedForeground }}
              >
                Create your first rule to start customizing AI behavior for your documents.
                Rules help guide content generation, quizzes, and more.
              </p>
              <Button onClick={handlers.handleCreateRule}>
                <Plus size={16} className="mr-2" />
                Create Your First Rule
              </Button>
            </div>
          </div>
        )}

        {/* Empty State - No Filtered Results */}
        {hasRules && !hasFilteredRules && (
          <div
            className="text-center py-16 rounded-lg border"
            style={{
              backgroundColor: currentTheme.colors.card,
              borderColor: currentTheme.colors.border,
            }}
          >
            <div className="max-w-md mx-auto">
              <Search
                size={32}
                className="mx-auto mb-4"
                style={{ color: currentTheme.colors.mutedForeground }}
              />
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: currentTheme.colors.foreground }}
              >
                No rules found
              </h3>
              <p
                className="text-sm mb-6"
                style={{ color: currentTheme.colors.mutedForeground }}
              >
                No rules match your search criteria. Try adjusting your search or filters.
              </p>
              <Button
                variant="outline"
                onClick={handleClearSearchAndFilters}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Rules Grid/List */}
        {hasFilteredRules && (
          <>
            <div className="flex items-center justify-between">
              <p
                className="text-sm"
                style={{ color: currentTheme.colors.mutedForeground }}
              >
                {filteredRules.length} {filteredRules.length === 1 ? 'rule' : 'rules'} found
              </p>
            </div>

            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  : 'space-y-3'
              )}
            >
              {filteredRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={handlers.handleEditRule}
                  onDelete={handlers.handleDeleteRule}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Page>
  );
};
