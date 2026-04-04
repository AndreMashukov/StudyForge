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
  /** PanelType tab to navigate to on the directory page after submission/back. */
  directoryTab: string;
}
