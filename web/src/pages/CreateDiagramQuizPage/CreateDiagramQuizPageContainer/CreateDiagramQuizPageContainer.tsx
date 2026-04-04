import React, { useMemo } from 'react';
import { Network } from 'lucide-react';
import { RuleApplicability } from '@shared-types';
import { useCreateDiagramQuizPageContext } from '../context/hooks/useCreateDiagramQuizPageContext';
import { ArtifactFormLayout } from '../../../components/ArtifactFormLayout';
import { ArtifactFormConfig } from '../../../components/ArtifactFormLayout/types';

const diagramQuizFormConfig: ArtifactFormConfig = {
  title: 'Create Diagram Quiz',
  cardTitle: 'Diagram Quiz Configuration',
  cardIcon: <Network size={24} />,
  nameFieldName: 'diagramQuizName',
  nameFieldLabel: 'Quiz Name',
  ruleApplicability: RuleApplicability.DIAGRAM_QUIZ,
  additionalPromptPlaceholder: 'e.g. Focus on architecture diagrams, use sequence diagrams only, etc.',
  additionalPromptHelperText: 'Customize how Mermaid diagrams are generated',
  generateLabels: {
    single: 'Generate Diagram Quiz',
    plural: (count) => `Generate diagram quiz from ${count} documents`,
    submitting: 'Generating Diagram Quiz...',
  },
  directoryTab: 'diagramQuizzes',
};

export const CreateDiagramQuizPageContainer: React.FC = () => {
  const { documentsApi, form, handlers } = useCreateDiagramQuizPageContext();

  const config = useMemo(() => diagramQuizFormConfig, []);

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
