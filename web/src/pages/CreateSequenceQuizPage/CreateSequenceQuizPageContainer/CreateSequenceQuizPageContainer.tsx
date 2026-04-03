import React, { useMemo } from 'react';
import { ListOrdered } from 'lucide-react';
import { RuleApplicability } from '@shared-types';
import { useCreateSequenceQuizPageContext } from '../context/hooks/useCreateSequenceQuizPageContext';
import { ArtifactFormLayout } from '../../../components/ArtifactFormLayout';
import { ArtifactFormConfig } from '../../../components/ArtifactFormLayout/types';

const sequenceQuizFormConfig: ArtifactFormConfig = {
  title: 'Create Sequence Quiz',
  cardTitle: 'Sequence Quiz Configuration',
  cardIcon: <ListOrdered size={24} />,
  nameFieldName: 'sequenceQuizName',
  nameFieldLabel: 'Quiz Name',
  ruleApplicability: RuleApplicability.SEQUENCE_QUIZ,
  additionalPromptPlaceholder:
    'e.g. Focus on sentence construction, decompose algorithm steps, use historical events, etc.',
  additionalPromptHelperText:
    'Specialise how sequences are generated. Without rules, Gemini infers meaningful orderings from the source content.',
  generateLabels: {
    single: 'Generate Sequence Quiz',
    plural: (count) => `Generate sequence quiz from ${count} documents`,
    submitting: 'Generating Sequence Quiz...',
  },
};

export const CreateSequenceQuizPageContainer: React.FC = () => {
  const { documentsApi, form, handlers } = useCreateSequenceQuizPageContext();

  const config = useMemo(() => sequenceQuizFormConfig, []);

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
