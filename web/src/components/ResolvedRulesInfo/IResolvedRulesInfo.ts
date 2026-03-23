import { RuleApplicability } from '@shared-types';

export interface IResolvedRulesInfo {
  directoryId: string | null;
  operation: RuleApplicability;
}
