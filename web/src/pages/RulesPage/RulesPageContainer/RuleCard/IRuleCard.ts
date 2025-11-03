import { Rule } from '@shared-types';

export interface IRuleCard {
  rule: Rule;
  onEdit: (rule: Rule) => void;
  onDelete: (ruleId: string) => void;
  viewMode: 'grid' | 'list';
}
