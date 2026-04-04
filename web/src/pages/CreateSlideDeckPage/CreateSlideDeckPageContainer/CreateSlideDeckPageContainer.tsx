import React, { useMemo } from 'react';
import { Presentation } from 'lucide-react';
import { RuleApplicability } from '@shared-types';
import { useCreateSlideDeckPageContext } from '../context/hooks/useCreateSlideDeckPageContext';
import { ArtifactFormLayout } from '../../../components/ArtifactFormLayout';
import { ArtifactFormConfig } from '../../../components/ArtifactFormLayout/types';

const slideDeckFormConfig: ArtifactFormConfig = {
  title: 'Create Slide Deck',
  cardTitle: 'Slide Deck Configuration',
  cardIcon: <Presentation size={24} />,
  nameFieldName: 'slideDeckName',
  nameFieldLabel: 'Slide Deck Name',
  ruleApplicability: RuleApplicability.SLIDE_DECK,
  defaultNameFn: (docTitle) => `Slides for ${docTitle}`,
  additionalPromptPlaceholder: 'e.g., Focus on architecture diagrams, keep slides concise, use more visuals, etc.',
  additionalPromptHelperText: 'Provide specific instructions to customize your slide deck generation',
  generateLabels: {
    single: 'Generate Slide Deck',
    plural: (count) => `Generate Slide Deck from ${count} documents`,
    submitting: 'Generating Slide Deck...',
  },
  directoryTab: 'slides',
};

export const CreateSlideDeckPageContainer = () => {
  const { documentsApi, form, handlers } = useCreateSlideDeckPageContext();

  const config = useMemo(() => slideDeckFormConfig, []);

  return (
    <ArtifactFormLayout
      config={config}
      documentsApi={documentsApi}
      form={form}
      onSubmit={handlers.handleSubmit}
      isSubmitting={handlers.isSubmitting}
    />
  );
};
