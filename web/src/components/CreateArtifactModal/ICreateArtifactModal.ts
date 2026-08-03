import { ReactNode } from 'react';
import { RuleApplicability } from '@shared-types';
import { ArtifactPanelType } from '../../store/slices/artifactGenerationSlice';

export type CreateArtifactModalType = Exclude<ArtifactPanelType, 'sources'>;

export interface ICreateArtifactModalOpenState {
  artifactType: CreateArtifactModalType;
  directoryId: string;
  preselectedDocumentIds?: string[];
}

export interface ICreateArtifactFormValues {
  documentIds: string[];
  name: string;
  additionalPrompt: string;
  ruleIds: string[];
  followupRuleIds: string[];
  descriptionRuleIds: string[];
}

export interface ICreateArtifactModalConfig {
  title: string;
  icon: ReactNode;
  nameFieldLabel: string;
  defaultNameFn?: (docTitle: string) => string;
  additionalPromptPlaceholder: string;
  additionalPromptHelperText: string;
  ruleApplicability: RuleApplicability;
  followupRuleApplicability?: RuleApplicability;
  descriptionRuleApplicability?: RuleApplicability;
  generateLabels: {
    single: string;
    plural: (count: number) => string;
  };
  directoryTab: string;
}

export interface ICreateArtifactModalProps {
  open: boolean;
  state: ICreateArtifactModalOpenState | null;
  onClose: () => void;
}
