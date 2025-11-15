import { useRulesPageContext } from '../context/hooks/useRulesPageContext';
import { Page } from '../../../components/Page';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RuleCard } from './RuleCard';
import { RuleFormModal } from '../../../components/RuleFormModal';
import { Plus, Search, Grid3x3, List, Loader2 } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { cn } from '../../../lib/utils';

export const RulesPageContainer = () => {
  const {
    rulesApi,
    handlers,
    viewMode,
    searchQuery,
    filteredRules,
  } = useRulesPageContext();
  
  const { currentTheme } = useTheme();

  // Loading state
  if (rulesApi.isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 
              className="animate-spin" 
              size={32}
              style={{ color: currentTheme.colors.primary }}
            />
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
              className="text-3xl font-bold"
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
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search 
                size={16} 
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: currentTheme.colors.mutedForeground }}
              />
              <Input
                placeholder="Search rules by name, description, tags..."
                value={searchQuery}
                onChange={(e) => handlers.handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            
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
              >
                <Grid3x3 size={16} />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handlers.handleViewModeChange('list')}
                className="px-3"
              >
                <List size={16} />
              </Button>
            </div>
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
                onClick={() => handlers.handleSearchChange('')}
              >
                Clear Search
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

      {/* Modals */}
      {handlers.isCreateModalOpen && (
        <RuleFormModal
          open={handlers.isCreateModalOpen}
          onClose={handlers.handleCloseCreateModal}
          onSuccess={(rule) => {
            rulesApi.refetch();
            handlers.handleCloseCreateModal();
          }}
        />
      )}

      {handlers.isEditModalOpen && handlers.selectedRule && (
        <RuleFormModal
          open={handlers.isEditModalOpen}
          ruleId={handlers.selectedRule.id}
          onClose={handlers.handleCloseEditModal}
          onSuccess={(rule) => {
            rulesApi.refetch();
            handlers.handleCloseEditModal();
          }}
        />
      )}
    </Page>
  );
};
