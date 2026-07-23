import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UseFormReturn } from 'react-hook-form';
import { useGenerateSubjectWorldMutation } from '../../../../store/api/SubjectWorld/SubjectWorldApi';
import { ICreateSubjectWorldFormData } from '../../types/ICreateSubjectWorldPageTypes';
import { DocumentEnhanced } from '@shared-types';
import { buildDirectoryPathWithOptionalName } from '../../../../utils/directoryUrl';

interface IProps {
  form: UseFormReturn<ICreateSubjectWorldFormData>;
  documents: DocumentEnhanced[];
}

export const useCreateSubjectWorldPageHandlers = ({ form, documents }: IProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [generateSubjectWorld] =
    useGenerateSubjectWorldMutation();

  const handleSubmit = useCallback(
    async (formData: ICreateSubjectWorldFormData) => {
      if (!formData.documentIds?.length) return;

      const primaryDocumentId = formData.documentIds[0];
      const primaryDocument = documents.find((d) => d.id === primaryDocumentId);
      const directoryIdFromUrl = searchParams.get('directoryId')?.trim() || undefined;
      const resolvedDirectoryId =
        directoryIdFromUrl ?? primaryDocument?.directoryId ?? undefined;

      if (!resolvedDirectoryId) {
        navigate('/documents');
        return;
      }

      generateSubjectWorld({
        documentIds: formData.documentIds,
        directoryId: resolvedDirectoryId,
        subjectWorldName: formData.subjectWorldName?.trim() || undefined,
        additionalPrompt: formData.additionalPrompt?.trim() || undefined,
        ruleIds: formData.ruleIds || [],
        followupRuleIds: formData.followupRuleIds || [],
        ruleResolutionMode: 'explicit-only',
      });
      navigate(buildDirectoryPathWithOptionalName(resolvedDirectoryId, undefined, 'subjectWorlds'));
    },
    [generateSubjectWorld, navigate, documents, searchParams]
  );

  return {
    handleSubmit: form.handleSubmit(handleSubmit),
  };
};
