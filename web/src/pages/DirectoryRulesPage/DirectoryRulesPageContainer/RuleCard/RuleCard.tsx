import { Pin, Tag, X } from 'lucide-react';
import { Rule, RuleApplicability, RuleColor } from '@shared-types';
import { useTheme } from '../../../../contexts/ThemeContext';
import { Button } from '../../../../components/ui/Button';
import { BulkSelectCheckbox } from '../../../../components/BulkSelectCheckbox';
import { cn } from '../../../../lib/utils';

export interface IDirectoryRuleCard {
  rule: Rule;
  onEdit: () => void;
  onRemove?: () => void;
  isInherited?: boolean;
  showRemoveButton?: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  /** Applies by default in the folder being viewed (always apply, ADR 016). */
  alwaysApply?: boolean;
  onToggleAlwaysApply?: () => void;
  alwaysApplyDisabled?: boolean;
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
    [RuleApplicability.PROMPT]: 'AI Document',
    [RuleApplicability.QUIZ]: 'Quiz',
    [RuleApplicability.FLASHCARD]: 'Flashcard',
    [RuleApplicability.FLASHCARD_DESC]: 'Flashcard Description',
    [RuleApplicability.SLIDE_DECK]: 'Slide Deck',
    [RuleApplicability.DIAGRAM_QUIZ]: 'Diagram Quiz',
    [RuleApplicability.SEQUENCE_QUIZ]: 'Sequence Quiz',
    [RuleApplicability.AGENT]: 'Workspace agent',
  };
  return labels[applicability];
};

export const RuleCard = ({
  rule,
  onEdit,
  onRemove,
  isInherited = false,
  showRemoveButton = false,
  selected = false,
  onSelectChange,
  alwaysApply = false,
  onToggleAlwaysApply,
  alwaysApplyDisabled = false,
}: IDirectoryRuleCard) => {
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;
  const ruleAccentColor = getRuleAccentColor(rule.color);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border p-4 pl-5 transition-colors',
        selected && 'ring-2 ring-primary',
      )}
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
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {onSelectChange && !isInherited && (
            <BulkSelectCheckbox
              checked={selected}
              onCheckedChange={onSelectChange}
              label={`Select prompt ${rule.name}`}
              className="mt-1"
            />
          )}
          <div className="flex-1 min-w-0">
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
                  <Tag className="h-3.5 w-3.5" aria-hidden="true" />
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
        </div>

        {/* Actions */}
        <div className="flex gap-2 ml-4">
          {onToggleAlwaysApply && (
            <Button
              variant={alwaysApply ? 'secondary' : 'ghost'}
              size="sm"
              onClick={onToggleAlwaysApply}
              disabled={alwaysApplyDisabled}
              aria-pressed={alwaysApply}
              title={
                alwaysApply
                  ? 'Applied by default to what you create in this folder. Click to switch it off here; subfolders are not changed.'
                  : 'Not applied by default in this folder. Click to switch it back on here.'
              }
              className="gap-1.5"
            >
              <Pin
                className={cn('h-3.5 w-3.5', alwaysApply && 'fill-current')}
                aria-hidden="true"
              />
              {alwaysApply ? 'On by default' : 'Off by default'}
            </Button>
          )}
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
              aria-label={`Remove ${rule.name}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
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
