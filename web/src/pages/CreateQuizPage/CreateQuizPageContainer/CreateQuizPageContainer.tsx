import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCreateQuizPageContext } from '../context/hooks/useCreateQuizPageContext';
import { selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Textarea } from '../../../components/ui/Textarea';
import { PreSelectedDocumentSelector } from '../../../components/PreSelectedDocumentSelector';
import { RuleSelector } from '../../../components/RuleSelector';
import { createQuizPageStyles } from './CreateQuizPageContainer.styles';
import { ArrowLeft, Brain } from 'lucide-react';
import { RuleApplicability } from '@shared-types';

export const CreateQuizPageContainer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDocumentId = searchParams.get('documentId') ?? undefined;
  const directoryIdParam = searchParams.get('directoryId');
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);

  const { documentsApi, form, handlers } = useCreateQuizPageContext();
  const { handleSubmit, isSubmitting } = handlers;

  const { data: documentsResponse, isLoading } = documentsApi;
  const documents = useMemo(() => documentsResponse?.documents || [], [documentsResponse]);
  const { register, watch, setValue, formState: { errors } } = form;

  const watchedDocumentIds = watch('documentIds');
  const watchedQuizName = watch('quizName');
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

  // useRef guard: apply preselection exactly once on mount
  const preselectionApplied = useRef(false);
  useEffect(() => {
    if (preselectedDocumentId && documents.length > 0 && !preselectionApplied.current) {
      const docExists = documents.find(d => d.id === preselectedDocumentId);
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
    const next = current.includes(id)
      ? current.filter(d => d !== id)
      : [...current, id];
    setValue('documentIds', next, { shouldValidate: true });
  };

  const docCount = watchedDocumentIds?.length ?? 0;
  const generateLabel = docCount > 1
    ? `Generate Quiz from ${docCount} documents`
    : 'Generate Quiz';

  return (
    <Page showSidebar={false}>
      <div className={createQuizPageStyles.container}>
        {/* Header */}
        <header className={createQuizPageStyles.header}>
          <div className={createQuizPageStyles.headerContent}>
            <button onClick={handleBack} className={createQuizPageStyles.backButton}>
              <ArrowLeft size={20} />
              Back to Documents
            </button>
            <h1 className={createQuizPageStyles.title}>Create Quiz</h1>
            <div></div>
          </div>
        </header>

        {/* Content */}
        <div className={createQuizPageStyles.content}>
          <Card className={createQuizPageStyles.formCard}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain size={24} />
                Quiz Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Document Selection */}
                <div className={createQuizPageStyles.formField}>
                  <Label>Source Documents *</Label>
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

                {/* Quiz Name */}
                <div className={createQuizPageStyles.formField}>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="quizName">Quiz Name (Optional)</Label>
                    <span className="text-xs text-muted-foreground">
                      {watchedQuizName?.length || 0}/100 characters
                    </span>
                  </div>
                  <Input
                    {...register('quizName')}
                    id="quizName"
                    type="text"
                    placeholder="Leave empty for auto-generated name"
                    maxLength={100}
                  />
                  {errors.quizName && (
                    <p className="text-sm text-destructive">{errors.quizName.message}</p>
                  )}
                  {docCount > 0 && !watchedQuizName?.trim() && (
                    <p className="text-sm text-muted-foreground">
                      Default name: &quot;Quiz from{' '}
                      {documents.find((d) => d.id === watchedDocumentIds?.[0])?.title}&quot;
                    </p>
                  )}
                </div>

                {/* Additional Prompt */}
                <div className={createQuizPageStyles.formField}>
                  <Textarea
                    {...register('additionalPrompt')}
                    id="additionalPrompt"
                    label="Additional Instructions (Optional)"
                    placeholder="e.g., Focus on AWS VPC related paragraphs, make questions more challenging, etc."
                    showCharCount={true}
                    maxLength={500}
                    helperText="Provide specific instructions to customize your quiz generation"
                    rows={4}
                  />
                  {errors.additionalPrompt && (
                    <p className="text-sm text-destructive">{errors.additionalPrompt.message}</p>
                  )}
                </div>

                {/* Rules */}
                <RuleSelector
                  directoryId={directoryIdParam ?? ''}
                  operation={RuleApplicability.QUIZ}
                  selectedRuleIds={watchedRuleIds ?? []}
                  onSelectionChange={handleRuleSelectionChange}
                />

                {/* Form Actions */}
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
