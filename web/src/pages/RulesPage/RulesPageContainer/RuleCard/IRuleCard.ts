import { Rule } from '@shared-types';

export interface IRuleCard {
  rule: Rule;
  onDelete: (ruleId: string) => void;
  viewMode: 'grid' | 'list';
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}
