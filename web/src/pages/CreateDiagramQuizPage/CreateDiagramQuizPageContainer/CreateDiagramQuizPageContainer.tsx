import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCreateDiagramQuizPageContext } from '../context/hooks/useCreateDiagramQuizPageContext';
import { selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Textarea } from '../../../components/ui/Textarea';
import { PreSelectedDocumentSelector } from '../../../components/PreSelectedDocumentSelector';
import { RuleSelector } from '../../../components/RuleSelector';
import { createQuizPageStyles } from '../../CreateQuizPage/CreateQuizPageContainer/CreateQuizPageContainer.styles';
import { ArrowLeft, Network } from 'lucide-react';
import { RuleApplicability } from '@shared-types';

export const CreateDiagramQuizPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDocumentId = searchParams.get('documentId') ?? undefined;
  const directoryIdParam = searchParams.get('directoryId');
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);

  const { documentsApi, form, handlers } = useCreateDiagramQuizPageContext();
  const { handleSubmit, isSubmitting } = handlers;

  const { data: documentsResponse, isLoading } = documentsApi;
  const allDocuments = useMemo(() => documentsResponse?.documents || [], [documentsResponse]);
  const resolvedDirectoryId = directoryIdParam || selectedDirectoryId;
  const documents = useMemo(
    () =>
      resolvedDirectoryId
        ? allDocuments.filter((d) => d.directoryId === resolvedDirectoryId)
        : allDocuments,
    [allDocuments, resolvedDirectoryId]
  );

  const { register, watch, setValue, formState: { errors } } = form;
  const watchedDocumentIds = watch('documentIds');
  const watchedName = watch('diagramQuizName');
  const watchedRuleIds = watch('ruleIds');

  const handleRuleSelectionChange = (ruleIds: string[]) => {
    setValue('ruleIds', ruleIds);
  };

  const handleBack = () => {
    if (directoryIdParam) {
      navigate(`/directory/${directoryIdParam}`);
    } else if (selectedDirectoryId) {
      navigate(`/directory/${selectedDirectoryId}`);
    } else {
      navigate('/documents');
    }
  };

  const preselectionApplied = useRef(false);
  useEffect(() => {
    if (preselectedDocumentId && documents.length > 0 && !preselectionApplied.current) {
      const docExists = documents.find((d) => d.id === preselectedDocumentId);
      if (docExists) {
        preselectionApplied.current = true;
        const current = form.getValues('documentIds');
        if (!current.includes(preselectedDocumentId)) {
          setValue('documentIds', [preselectedDocumentId, ...current], { shouldValidate: true });
        }
      }
    }
  }, [preselectedDocumentId, documents, setValue, form]);

  const handleDocumentToggle = (id: string) => {
    const current = form.getValues('documentIds');
    const next = current.includes(id) ? current.filter((d) => d !== id) : [...current, id];
    setValue('documentIds', next, { shouldValidate: true });
  };

  const docCount = watchedDocumentIds?.length ?? 0;
  const generateLabel =
    docCount > 1 ? `Generate diagram quiz from ${docCount} documents` : 'Generate diagram quiz';

  return (
    <Page showSidebar={false}>
      <div className={createQuizPageStyles.container}>
        <header className={createQuizPageStyles.header}>
          <div className={createQuizPageStyles.headerContent}>
            <button type="button" onClick={handleBack} className={createQuizPageStyles.backButton}>
              <ArrowLeft size={20} />
              Back to Documents
            </button>
            <h1 className={createQuizPageStyles.title}>Create diagram quiz</h1>
            <div />
          </div>
        </header>

        <div className={createQuizPageStyles.content}>
          <Card className={createQuizPageStyles.formCard}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network size={24} />
                Diagram quiz configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className={createQuizPageStyles.formField}>
                  <Label>Source documents *</Label>
                  <PreSelectedDocumentSelector
                    documents={documents}
                    selectedDocumentIds={watchedDocumentIds ?? []}
                    onDocumentToggle={handleDocumentToggle}
                    maxSelections={5}
                    isLoading={isLoading}
                    disabled={isLoading}
                    initialDocumentId={preselectedDocumentId}
                  />
                  {errors.documentIds && (
                    <p className="text-sm text-destructive">
                      {errors.documentIds.message ?? 'Please select at least one document'}
                    </p>
                  )}
                </div>

                <div className={createQuizPageStyles.formField}>
                  <div className="mb-2 flex items-center justify-between">
                    <Label htmlFor="diagramQuizName">Quiz name (optional)</Label>
                    <span className="text-xs text-muted-foreground">
                      {watchedName?.length || 0}/100 characters
                    </span>
                  </div>
                  <Input
                    {...register('diagramQuizName')}
                    id="diagramQuizName"
                    type="text"
                    placeholder="Leave empty for auto-generated name"
                    maxLength={100}
                  />
                  {errors.diagramQuizName && (
                    <p className="text-sm text-destructive">{errors.diagramQuizName.message}</p>
                  )}
                </div>

                <div className={createQuizPageStyles.formField}>
                  <Textarea
                    {...register('additionalPrompt')}
                    id="additionalPrompt"
                    label="Additional instructions (optional)"
                    placeholder="e.g. Focus on architecture diagrams, use sequence diagrams only, etc."
                    showCharCount={true}
                    maxLength={500}
                    helperText="Customize how Mermaid diagrams are generated"
                    rows={4}
                  />
                  {errors.additionalPrompt && (
                    <p className="text-sm text-destructive">{errors.additionalPrompt.message}</p>
                  )}
                </div>

                <RuleSelector
                  directoryId={directoryIdParam ?? ''}
                  operation={RuleApplicability.DIAGRAM_QUIZ}
                  selectedRuleIds={watchedRuleIds ?? []}
                  onSelectionChange={handleRuleSelectionChange}
                />

                <div className={createQuizPageStyles.formActions}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className={createQuizPageStyles.cancelButton}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={createQuizPageStyles.submitButton}
                    disabled={isSubmitting || docCount === 0}
                  >
                    {generateLabel}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
};
