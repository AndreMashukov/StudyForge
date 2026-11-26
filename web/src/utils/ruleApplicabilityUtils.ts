import { RuleApplicability } from '@shared-types';

const RULE_APPLICABILITY_VALUES: ReadonlySet<string> = new Set(Object.values(RuleApplicability));

export const isRuleApplicability = (value: unknown): value is RuleApplicability =>
  typeof value === 'string' && RULE_APPLICABILITY_VALUES.has(value);

/**
 * Keeps only current applicabilities. Stored rules can still hold retired values
 * (`followup`, `chat`) that nothing applies any more.
 */
export const toCurrentRuleApplicabilities = (values: unknown): RuleApplicability[] =>
  Array.isArray(values) ? values.filter(isRuleApplicability) : [];

export const ruleApplicabilityLabels: Record<RuleApplicability, string> = {
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

export const getRuleApplicabilityLabel = (applicability: RuleApplicability): string => {
  const label = ruleApplicabilityLabels[applicability];

  if (label) {
    return label;
  }

  return applicability
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};