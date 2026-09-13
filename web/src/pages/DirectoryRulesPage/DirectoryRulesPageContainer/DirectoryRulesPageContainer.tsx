import { Page } from '../../../components/Page';
import { Button } from '../../../components/ui/Button';
import { useDirectoryRulesPage } from '../context/DirectoryRulesPageContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { RuleCard } from './RuleCard';
import { AssignRuleModal } from './AssignRuleModal';
import { RuleCascadeVisualization } from './RuleCascadeVisualization';
import { Spinner } from '../../../components/ui/Spinner';
import { VirtualizedList } from '../../../components/VirtualizedList';

export type DirectoryRulesViewVariant = 'page' | 'panel';

interface DirectoryRulesPageContainerProps {
  variant?: DirectoryRulesViewVariant;
}

export const DirectoryRulesPageContainer = ({
  variant = 'page',
}: DirectoryRulesPageContainerProps) => {
  const { state, handlers, bulkDetach } = useDirectoryRulesPage();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  const isPanel = variant === 'panel';

  const loadingContent = (
    <div
      className={
        isPanel
          ? 'flex items-center justify-center py-16'
          : 'flex items-center justify-center min-h-[400px]'
      }
    >
      <div className="text-center">
        <Spinner size="lg" variant="muted" className="mx-auto" />
        <p
          className="mt-4 font-medium"
          style={{ color: currentTheme.colors.mutedForeground }}
        >
          Loading directory rules...
        </p>
      </div>
    </div>
  );

  if (state.loading) {
    if (isPanel) {
      return loadingContent;
    }
    return (
      <Page showSidebar={true}>
        <div className="max-w-6xl mx-auto px-4 py-8">{loadingContent}</div>
      </Page>
    );
  }

  if (state.error || !state.directory) {
    const errorContent = (
      <div className="text-center">
        <p style={{ color: currentTheme.colors.destructive }}>
          {state.error || 'Directory not found'}
        </p>
        {!isPanel && (
          <Button onClick={() => navigate('/documents')} className="mt-4">
            Back to Documents
          </Button>
        )}
      </div>
    );

    if (isPanel) {
      return <div className="py-8">{errorContent}</div>;
    }
    return (
      <Page showSidebar={true}>
        <div className="max-w-6xl mx-auto px-4 py-8">{errorContent}</div>
      </Page>
    );
  }

  const { directory, directRules, inheritedRules, isCascadeViewOpen, isAssignModalOpen } = state;
  const {
    handleAssignRule,
    handleToggleCascadeView,
    handleCloseAssignModal,
    handleRemoveRule,
    handleEditRule,
  } = handlers;

  const parentRules = Object.entries(inheritedRules)
    .filter(([dirId]) => dirId !== state.directoryId)
    .reduce(
      (acc, [dirId, rules]) => {
        acc[dirId] = rules;
        return acc;
      },
      {} as { [directoryId: string]: (typeof inheritedRules)[string] },
    );

  const rulesContent = (
    <>
      <div className={isPanel ? 'mb-4' : 'mb-6'}>
        <div className="flex items-center justify-between mb-4">
          <div>
            {!isPanel && (
              <button
                onClick={() => navigate('/documents')}
                className="flex items-center gap-2 mb-2 hover:underline"
                style={{ color: currentTheme.colors.primary }}
              >
                <span>←</span>
                <span>Back</span>
              </button>
            )}
            <h1
              className={
                isPanel
                  ? 'text-lg font-semibold font-heading'
                  : 'text-3xl font-bold font-heading'
              }
              style={{ color: currentTheme.colors.foreground }}
            >
              Directory Rules: {directory.name}
            </h1>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={handleToggleCascadeView}>
              {isCascadeViewOpen ? 'Hide' : 'Show'} Inheritance Chain
            </Button>
            <Button onClick={handleAssignRule}>+ Assign Rule</Button>
          </div>
        </div>

        <div className="text-sm" style={{ color: currentTheme.colors.mutedForeground }}>
          Path: {directory.path || '/'}
        </div>
      </div>

      {isCascadeViewOpen && (
        <div className={isPanel ? 'mb-4' : 'mb-8'}>
          <RuleCascadeVisualization />
        </div>
      )}

      <div className={isPanel ? 'mb-4' : 'mb-8'}>
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: currentTheme.colors.card,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="mb-4 min-h-10">
            {directRules.length > 0 && bulkDetach.selectedCount > 0 ? (
              bulkDetach.toolbar
            ) : (
              <h2
                className="flex min-h-10 items-center gap-2 text-xl font-semibold"
                style={{ color: currentTheme.colors.foreground }}
              >
                <span role="img" aria-label="clipboard">
                  📋
                </span>{' '}
                Rules Assigned to This Directory ({directRules.length})
              </h2>
            )}
          </div>

          {directRules.length === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: currentTheme.colors.mutedForeground }}
            >
              <p className="mb-4">No rules directly assigned to this directory.</p>
              <Button onClick={handleAssignRule}>Assign Your First Rule</Button>
            </div>
          ) : (
            <VirtualizedList
              items={directRules}
              scrollMode="window"
              estimateSize={120}
              gap={12}
              renderItem={(rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={() => handleEditRule(rule.id)}
                  onRemove={() => handleRemoveRule(rule.id)}
                  showRemoveButton
                  selected={bulkDetach.isSelected(rule.id)}
                  onSelectChange={(checked) => {
                    if (checked !== bulkDetach.isSelected(rule.id)) {
                      bulkDetach.toggle(rule.id);
                    }
                  }}
                />
              )}
            />
          )}
        </div>
      </div>

      {Object.keys(parentRules).length > 0 && (
        <div className={isPanel ? 'mb-4' : 'mb-8'}>
          <div
            className="rounded-lg border p-6"
            style={{
              backgroundColor: currentTheme.colors.card,
              borderColor: currentTheme.colors.border,
            }}
          >
            <h2
              className="text-xl font-semibold mb-4 flex items-center gap-2"
              style={{ color: currentTheme.colors.foreground }}
            >
              <span role="img" aria-label="outbox">
                📤
              </span>{' '}
              Inherited from Parent Directories
            </h2>

            <div className="space-y-6">
              {Object.entries(parentRules).map(([dirId, rules]) => (
                <div key={dirId}>
                  <div
                    className="rounded-lg border p-4"
                    style={{
                      backgroundColor: currentTheme.colors.background,
                      borderColor: currentTheme.colors.border,
                    }}
                  >
                    <div
                      className="text-sm font-medium mb-3 flex items-center gap-2"
                      style={{ color: currentTheme.colors.mutedForeground }}
                    >
                      <span role="img" aria-label="folder">
                        📁
                      </span>{' '}
                      From: {/* TODO: Get directory name from ID */}
                      <span className="text-xs">(Inherited)</span>
                    </div>

                    <VirtualizedList
                      items={rules}
                      scrollMode="window"
                      estimateSize={96}
                      gap={8}
                      renderItem={(rule) => (
                        <RuleCard
                          key={rule.id}
                          rule={rule}
                          onEdit={() => handleEditRule(rule.id)}
                          isInherited
                        />
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAssignModalOpen && <AssignRuleModal onClose={handleCloseAssignModal} />}
      {bulkDetach.dialogs}
    </>
  );

  if (isPanel) {
    return <div className="space-y-4">{rulesContent}</div>;
  }

  return (
    <Page showSidebar={true}>
      <div className="max-w-6xl mx-auto px-4 py-8">{rulesContent}</div>
    </Page>
  );
};
