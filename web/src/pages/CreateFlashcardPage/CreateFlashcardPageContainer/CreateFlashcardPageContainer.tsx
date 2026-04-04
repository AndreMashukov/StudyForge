import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { RuleApplicability } from '@shared-types';
import { useCreateFlashcardPageContext } from '../context/hooks/useCreateFlashcardPageContext';
import { ArtifactFormLayout } from '../../../components/ArtifactFormLayout';
import { ArtifactFormConfig } from '../../../components/ArtifactFormLayout/types';

const flashcardFormConfig: ArtifactFormConfig = {
  title: 'Create Flashcards',
  cardTitle: 'Flashcard Configuration',
  cardIcon: <Layers size={24} />,
  nameFieldName: 'flashcardName',
  nameFieldLabel: 'Flashcard Set Name',
  ruleApplicability: RuleApplicability.FLASHCARD,
  defaultNameFn: (docTitle) => `Flashcards for ${docTitle}`,
  additionalPromptPlaceholder: 'e.g., Focus on key definitions, include code examples, make cards more detailed, etc.',
  additionalPromptHelperText: 'Provide specific instructions to customize your flashcard generation',
  generateLabels: {
    single: 'Generate Flashcards',
    plural: (count) => `Generate Flashcards from ${count} documents`,
    submitting: 'Generating Flashcards...',
  },
  directoryTab: 'cards',
};

export const CreateFlashcardPageContainer = () => {
  const { documentsApi, form, handlers } = useCreateFlashcardPageContext();

  const config = useMemo(() => flashcardFormConfig, []);

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
