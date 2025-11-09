import { Page } from '../../../components/Page';
import { Button } from '../../../components/ui/Button';
import { useDirectoryRulesPage } from '../context/DirectoryRulesPageContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { RuleCard } from './RuleCard';
import { AssignRuleModal } from './AssignRuleModal';
import { RuleCascadeVisualization } from './RuleCascadeVisualization';

export const DirectoryRulesPageContainer = () => {
  const { state, handlers } = useDirectoryRulesPage();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();

  if (state.loading) {
    return (
      <Page showSidebar={true}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div 
                className="animate-spin rounded-full h-12 w-12 border-4 mx-auto"
                style={{ 
                  borderColor: currentTheme.colors.muted,
                  borderTopColor: currentTheme.colors.primary,
                }}
              ></div>
              <p 
                className="mt-4 font-medium"
                style={{ color: currentTheme.colors.mutedForeground }}
              >
                Loading directory rules...
              </p>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  if (state.error || !state.directory) {
    return (
      <Page showSidebar={true}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">
            <p style={{ color: currentTheme.colors.destructive }}>
              {state.error || 'Directory not found'}
            </p>
            <Button 
              onClick={() => navigate('/documents')}
              className="mt-4"
            >
              Back to Documents
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  const { directory, directRules, inheritedRules, isCascadeViewOpen, isAssignModalOpen } = state;
  const { handleAssignRule, handleToggleCascadeView, handleCloseAssignModal, handleRemoveRule, handleEditRule } = handlers;

  // Get inherited rules (exclude current directory)
  const parentRules = Object.entries(inheritedRules)
    .filter(([dirId]) => dirId !== state.directoryId)
    .reduce((acc, [dirId, rules]) => {
      acc[dirId] = rules;
      return acc;
    }, {} as { [directoryId: string]: typeof inheritedRules[string] });

  return (
    <Page showSidebar={true}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <button
                onClick={() => navigate('/documents')}
                className="flex items-center gap-2 mb-2 hover:underline"
                style={{ color: currentTheme.colors.primary }}
              >
                <span>←</span>
                <span>Back</span>
              </button>
              <h1 
                className="text-3xl font-bold"
                style={{ color: currentTheme.colors.foreground }}
              >
                Directory Rules: {directory.name}
              </h1>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleToggleCascadeView}
              >
                {isCascadeViewOpen ? 'Hide' : 'Show'} Inheritance Chain
              </Button>
              <Button onClick={handleAssignRule}>
                + Assign Rule
              </Button>
            </div>
          </div>
          
          <div 
            className="text-sm"
            style={{ color: currentTheme.colors.mutedForeground }}
          >
            Path: {directory.path || '/'}
          </div>
        </div>

        {/* Rule Cascade Visualization */}
        {isCascadeViewOpen && (
          <div className="mb-8">
            <RuleCascadeVisualization />
          </div>
        )}

        {/* Rules Assigned to This Directory */}
        <div className="mb-8">
          <div 
            className="rounded-lg border p-6"
            style={{ 
              backgroundColor: currentTheme.colors.card,
              borderColor: currentTheme.colors.border,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 
                className="text-xl font-semibold flex items-center gap-2"
                style={{ color: currentTheme.colors.foreground }}
              >
                <span role="img" aria-label="clipboard">
                  📋
                </span>{' '}
                Rules Assigned to This Directory ({directRules.length})
              </h2>
            </div>

            {directRules.length === 0 ? (
              <div 
                className="text-center py-8"
                style={{ color: currentTheme.colors.mutedForeground }}
              >
                <p className="mb-4">No rules directly assigned to this directory.</p>
                <Button onClick={handleAssignRule}>
                  Assign Your First Rule
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {directRules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onEdit={() => handleEditRule(rule.id)}
                    onRemove={() => handleRemoveRule(rule.id)}
                    showRemoveButton
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inherited Rules */}
        {Object.keys(parentRules).length > 0 && (
          <div className="mb-8">
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

                      <div className="space-y-2">
                        {rules.map((rule) => (
                          <RuleCard
                            key={rule.id}
                            rule={rule}
                            onEdit={() => handleEditRule(rule.id)}
                            isInherited
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Assign Rule Modal */}
        {isAssignModalOpen && (
          <AssignRuleModal onClose={handleCloseAssignModal} />
        )}
      </div>
    </Page>
  );
};
