import { ReactNode } from 'react';
import { RuleApplicability } from '@shared-types';

export interface ArtifactFormConfig {
  title: string;
  cardTitle: string;
  cardIcon: ReactNode;
  nameFieldName: string;
  nameFieldLabel: string;
  ruleApplicability: RuleApplicability;
  defaultNameFn?: (docTitle: string) => string;
  additionalPromptPlaceholder: string;
  additionalPromptHelperText: string;
  generateLabels: {
    single: string;
    plural: (count: number) => string;
    submitting: string;
  };
}
