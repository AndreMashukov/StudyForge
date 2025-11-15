import { useTheme } from '../../../../contexts/ThemeContext';
import { useDirectoryRulesPage } from '../../context/DirectoryRulesPageContext';
import { useGetDirectoryAncestorsQuery } from '../../../../store/api/Directory/DirectoryApi';
import { Directory } from '@shared-types';

export const RuleCascadeVisualization = () => {
  const { currentTheme } = useTheme();
  const { state } = useDirectoryRulesPage();
  
  // Get directory ancestors
  const { data: ancestorsData } = useGetDirectoryAncestorsQuery(
    state.directoryId || '',
    { skip: !state.directoryId }
  );

  const ancestors = ancestorsData?.ancestors || [];
  
  // Early return if no directory
  if (!state.directory) {
    return null;
  }
  
  // Build the inheritance chain from root to current directory
  const chain: { directory: Directory; ruleCount: number }[] = [
    ...ancestors.map((dir) => ({
      directory: dir,
      ruleCount: state.inheritedRules[dir.id]?.length || 0,
    })),
    {
      directory: state.directory,
      ruleCount: state.directRules.length,
    },
  ];

  // Calculate total effective rules
  const totalRules = state.allRules.length;

  return (
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
        <span role="img" aria-label="tree">
          🌳
        </span>{' '}
        Rule Inheritance Chain
      </h2>

      <div className="space-y-4">
        {chain.map((item, index) => {
          const isLast = index === chain.length - 1;
          const isCurrent = isLast && state.directoryId === item.directory.id;
          const inheritedCount = state.inheritedRules[item.directory.id]?.filter(
            r => !state.directRules.find(dr => dr.id === r.id)
          ).length || 0;

          return (
            <div key={item.directory.id}>
              {/* Directory Box */}
              <div 
                className="rounded-lg border p-4"
                style={{ 
                  backgroundColor: isCurrent 
                    ? currentTheme.colors.accent 
                    : currentTheme.colors.background,
                  borderColor: isCurrent 
                    ? currentTheme.colors.primary 
                    : currentTheme.colors.border,
                  borderWidth: isCurrent ? 2 : 1,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="folder">
                      📁
                    </span>
                    <span 
                      className="font-medium"
                      style={{ color: currentTheme.colors.foreground }}
                    >
                      {item.directory.name || 'Root'}
                    </span>
                    {isCurrent && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ 
                          backgroundColor: currentTheme.colors.primary,
                          color: currentTheme.colors.primaryForeground,
                        }}
                      >
                        Current
                      </span>
                    )}
                  </div>
                  
                  <div 
                    className="text-sm"
                    style={{ color: currentTheme.colors.mutedForeground }}
                  >
                    {item.ruleCount} rule{item.ruleCount !== 1 ? 's' : ''}
                    {!isCurrent && inheritedCount > 0 && (
                      <span className="ml-2">
                        ({inheritedCount} inherited)
                      </span>
                    )}
                  </div>
                </div>

                {/* List rules if any */}
                {item.ruleCount > 0 && (
                  <div className="mt-2 space-y-1">
                    {(state.inheritedRules[item.directory.id] || state.directRules).map((rule) => (
                      <div 
                        key={rule.id}
                        className="text-sm px-2 py-1 rounded"
                        style={{ 
                          backgroundColor: currentTheme.colors.muted,
                          color: currentTheme.colors.mutedForeground,
                        }}
                      >
                        • {rule.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cascade Arrow */}
              {!isLast && (
                <div className="flex justify-center py-2">
                  <div 
                    className="text-sm flex items-center gap-2"
                    style={{ color: currentTheme.colors.mutedForeground }}
                  >
                    <span>↓</span>
                    <span>cascades to</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div 
        className="mt-6 pt-4 border-t"
        style={{ borderColor: currentTheme.colors.border }}
      >
        <div 
          className="text-sm font-medium"
          style={{ color: currentTheme.colors.foreground }}
        >
          Total Effective Rules: {totalRules}
        </div>
        <div 
          className="text-xs mt-1"
          style={{ color: currentTheme.colors.mutedForeground }}
        >
          (Applied when performing operations in this directory)
        </div>
      </div>
    </div>
  );
};
