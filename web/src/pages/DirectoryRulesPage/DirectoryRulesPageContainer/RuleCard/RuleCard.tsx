import { Rule, RuleApplicability } from '@shared-types';
import { useTheme } from '../../../../contexts/ThemeContext';
import { Button } from '../../../../components/ui/Button';

interface RuleCardProps {
  rule: Rule;
  onEdit: () => void;
  onRemove?: () => void;
  isInherited?: boolean;
  showRemoveButton?: boolean;
}

const getRuleColorStyles = (color: string) => {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    red: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
    orange: { bg: '#FFEDD5', border: '#F97316', text: '#9A3412' },
    yellow: { bg: '#FEF3C7', border: '#EAB308', text: '#854D0E' },
    green: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
    blue: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
    indigo: { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' },
    purple: { bg: '#EDE9FE', border: '#8B5CF6', text: '#5B21B6' },
    pink: { bg: '#FCE7F3', border: '#EC4899', text: '#9F1239' },
    gray: { bg: '#F3F4F6', border: '#6B7280', text: '#374151' },
  };

  return colorMap[color] || colorMap.gray;
};

const getApplicabilityLabel = (applicability: RuleApplicability): string => {
  const labels: Record<RuleApplicability, string> = {
    [RuleApplicability.SCRAPING]: 'Scraping',
    [RuleApplicability.UPLOAD]: 'Upload',
    [RuleApplicability.PROMPT]: 'Prompt',
    [RuleApplicability.QUIZ]: 'Quiz',
    [RuleApplicability.FOLLOWUP]: 'Followup',
  };
  return labels[applicability];
};

export const RuleCard = ({
  rule,
  onEdit,
  onRemove,
  isInherited = false,
  showRemoveButton = false,
}: RuleCardProps) => {
  const { currentTheme } = useTheme();
  const colorStyles = getRuleColorStyles(rule.color);

  return (
    <div 
      className="rounded-lg border-l-4 p-4"
      style={{ 
        backgroundColor: colorStyles.bg,
        borderLeftColor: colorStyles.border,
        borderTop: `1px solid ${currentTheme.colors.border}`,
        borderRight: `1px solid ${currentTheme.colors.border}`,
        borderBottom: `1px solid ${currentTheme.colors.border}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 
              className="font-semibold"
              style={{ color: colorStyles.text }}
            >
              {rule.name}
            </h3>
            {isInherited && (
              <span 
                className="text-xs px-2 py-0.5 rounded"
                style={{ 
                  backgroundColor: currentTheme.colors.muted,
                  color: currentTheme.colors.mutedForeground,
                }}
              >
                Inherited
              </span>
            )}
          </div>

          {/* Applicability badges */}
          <div className="flex flex-wrap gap-1 mb-2">
            {rule.applicableTo.map((applicability) => (
              <span
                key={applicability}
                className="text-xs px-2 py-1 rounded-md"
                style={{
                  backgroundColor: currentTheme.colors.secondary,
                  color: currentTheme.colors.secondaryForeground,
                }}
              >
                {getApplicabilityLabel(applicability)}
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

        {/* Actions */}
        <div className="flex gap-2 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
          >
            Edit
          </Button>
          {showRemoveButton && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              style={{ color: currentTheme.colors.destructive }}
            >
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      {rule.description && (
        <p 
          className="text-sm mt-2"
          style={{ color: currentTheme.colors.mutedForeground }}
        >
          {rule.description}
        </p>
      )}
    </div>
  );
};
