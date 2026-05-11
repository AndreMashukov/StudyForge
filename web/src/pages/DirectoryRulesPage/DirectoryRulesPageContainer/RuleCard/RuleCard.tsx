import { Rule, RuleApplicability, RuleColor } from '@shared-types';
import { useTheme } from '../../../../contexts/ThemeContext';
import { Button } from '../../../../components/ui/Button';

interface RuleCardProps {
  rule: Rule;
  onEdit: () => void;
  onRemove?: () => void;
  isInherited?: boolean;
  showRemoveButton?: boolean;
}

const ruleAccentColors: Record<RuleColor, string> = {
  [RuleColor.RED]: '#EF4444',
  [RuleColor.ORANGE]: '#F97316',
  [RuleColor.YELLOW]: '#EAB308',
  [RuleColor.GREEN]: '#10B981',
  [RuleColor.BLUE]: '#3B82F6',
  [RuleColor.INDIGO]: '#6366F1',
  [RuleColor.PURPLE]: '#8B5CF6',
  [RuleColor.PINK]: '#EC4899',
  [RuleColor.GRAY]: '#6B7280',
};

const getRuleAccentColor = (color: RuleColor) => ruleAccentColors[color] ?? ruleAccentColors[RuleColor.GRAY];

const getApplicabilityLabel = (applicability: RuleApplicability): string => {
  const labels: Record<RuleApplicability, string> = {
    [RuleApplicability.SCRAPING]: 'Scraping',
    [RuleApplicability.UPLOAD]: 'Upload',
    [RuleApplicability.PROMPT]: 'Prompt',
    [RuleApplicability.QUIZ]: 'Quiz',
    [RuleApplicability.FOLLOWUP]: 'Followup',
    [RuleApplicability.FLASHCARD]: 'Flashcard',
    [RuleApplicability.FLASHCARD_DESC]: 'Flashcard Description',
    [RuleApplicability.SLIDE_DECK]: 'Slide Deck',
    [RuleApplicability.DIAGRAM_QUIZ]: 'Diagram Quiz',
    [RuleApplicability.SEQUENCE_QUIZ]: 'Sequence Quiz',
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
  const colors = currentTheme.colors;
  const ruleAccentColor = getRuleAccentColor(rule.color);

  return (
    <div
      className="relative overflow-hidden rounded-lg border p-4 pl-5 transition-colors"
      style={{
        backgroundColor: colors.card,
        backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${ruleAccentColor} 10%, transparent), transparent 72px)`,
        borderColor: colors.border,
      }}
    >
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 top-0 w-1.5"
        style={{
          background: `linear-gradient(180deg, ${ruleAccentColor} 0%, color-mix(in srgb, ${ruleAccentColor} 62%, ${colors.primary}) 58%, transparent 100%)`,
        }}
      />
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3
              className="font-semibold"
              style={{ color: colors.cardForeground }}
            >
              {rule.name}
            </h3>
            {isInherited && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: colors.muted,
                  color: colors.mutedForeground,
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
                  backgroundColor: colors.secondary,
                  color: colors.secondaryForeground,
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
                style={{ color: colors.mutedForeground }}
              >
                <span role="img" aria-label="tags">
                  🏷️
                </span>
              </span>
              {rule.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs"
                  style={{ color: colors.mutedForeground }}
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
            style={{ color: colors.mutedForeground }}
          >
            Edit
          </Button>
          {showRemoveButton && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              style={{ color: colors.destructive }}
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
          style={{ color: colors.mutedForeground }}
        >
          {rule.description}
        </p>
      )}
    </div>
  );
};
