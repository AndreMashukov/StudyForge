import { RuleApplicability } from '@shared-types';

export const ruleApplicabilityLabels: Record<RuleApplicability, string> = {
  [RuleApplicability.SCRAPING]: 'Scraping',
  [RuleApplicability.UPLOAD]: 'Upload',
  [RuleApplicability.PROMPT]: 'Prompt',
  [RuleApplicability.QUIZ]: 'Quiz',
  [RuleApplicability.FOLLOWUP]: 'Followup',
  [RuleApplicability.CHAT]: 'Chat',
  [RuleApplicability.FLASHCARD]: 'Flashcard',
  [RuleApplicability.FLASHCARD_DESC]: 'Flashcard Description',
  [RuleApplicability.SLIDE_DECK]: 'Slide Deck',
  [RuleApplicability.DIAGRAM_QUIZ]: 'Diagram Quiz',
  [RuleApplicability.SEQUENCE_QUIZ]: 'Sequence Quiz',
  [RuleApplicability.SUBJECT_WORLD]: 'Subject World',
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