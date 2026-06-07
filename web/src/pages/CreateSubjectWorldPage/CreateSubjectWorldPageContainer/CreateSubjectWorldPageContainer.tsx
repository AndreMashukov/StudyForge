import React, { useMemo } from 'react';
import { Box } from 'lucide-react';
import { RuleApplicability } from '@shared-types';
import { useCreateSubjectWorldPageContext } from '../context/hooks/useCreateSubjectWorldPageContext';
import { ArtifactFormLayout } from '../../../components/ArtifactFormLayout';
import { ArtifactFormConfig } from '../../../components/ArtifactFormLayout/types';

const subjectWorldFormConfig: ArtifactFormConfig = {
  title: 'Create Subject World',
  cardTitle: 'Subject World Configuration',
  cardIcon: <Box size={24} />,
  nameFieldName: 'subjectWorldName',
  nameFieldLabel: 'World Name',
  ruleApplicability: RuleApplicability.SUBJECT_WORLD,
  followupRuleApplicability: RuleApplicability.FOLLOWUP,
  additionalPromptPlaceholder: 'e.g. Focus on hands-on exploration, more quiz gates, outdoor theme…',
  additionalPromptHelperText: 'Customize how the explorable world is generated',
  generateLabels: {
    single: 'Generate Subject World',
    plural: (count) => `Generate subject world from ${count} documents`,
    submitting: 'Generating Subject World...',
  },
  directoryTab: 'subjectWorlds',
};

export const CreateSubjectWorldPageContainer: React.FC = () => {
  const { documentsApi, form, handlers } = useCreateSubjectWorldPageContext();
  const config = useMemo(() => subjectWorldFormConfig, []);

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
