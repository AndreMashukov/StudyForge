import React, { useMemo } from 'react';
import { Brain } from 'lucide-react';
import { RuleApplicability } from '@shared-types';
import { useCreateQuizPageContext } from '../context/hooks/useCreateQuizPageContext';
import { ArtifactFormLayout } from '../../../components/ArtifactFormLayout';
import { ArtifactFormConfig } from '../../../components/ArtifactFormLayout/types';

const quizFormConfig: ArtifactFormConfig = {
  title: 'Create Quiz',
  cardTitle: 'Quiz Configuration',
  cardIcon: <Brain size={24} />,
  nameFieldName: 'quizName',
  nameFieldLabel: 'Quiz Name',
  ruleApplicability: RuleApplicability.QUIZ,
  defaultNameFn: (docTitle) => `Quiz from ${docTitle}`,
  additionalPromptPlaceholder: 'e.g., Focus on AWS VPC related paragraphs, make questions more challenging, etc.',
  additionalPromptHelperText: 'Provide specific instructions to customize your quiz generation',
  generateLabels: {
    single: 'Generate Quiz',
    plural: (count) => `Generate Quiz from ${count} documents`,
    submitting: 'Generating Quiz...',
  },
};

export const CreateQuizPageContainer = () => {
  const { documentsApi, form, handlers } = useCreateQuizPageContext();

  const config = useMemo(() => quizFormConfig, []);

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
