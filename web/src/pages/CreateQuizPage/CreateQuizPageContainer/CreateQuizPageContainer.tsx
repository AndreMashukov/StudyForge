import React, { useEffect, useState } from 'react';
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
import { CompactRuleSelector } from '../../../components/CompactRuleSelector';
import { PreSelectedDocumentSelector } from '../../../components/PreSelectedDocumentSelector';
import { createQuizPageStyles } from './CreateQuizPageContainer.styles';
import { ArrowLeft, Brain } from 'lucide-react';
import { RuleApplicability } from '@shared-types';

export const CreateQuizPageContainer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDocumentId = searchParams.get('documentId') ?? undefined;
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);
  const [quizRuleIds, setQuizRuleIds] = useState<string[]>([]);
  const [followupRuleIds, setFollowupRuleIds] = useState<string[]>([]);

  const { 
    documentsApi,
    form,
    handlers 
  } = useCreateQuizPageContext();

  const { 
    handleSubmit,
  } = handlers;

  const { data: documentsResponse, isLoading } = documentsApi;
  const documents = documentsResponse?.documents || [];
  const { register, watch, setValue, formState: { errors } } = form;
  const watchedDocumentId = watch('documentId');
  const watchedQuizName = watch('quizName');

  const handleBack = () => {
    if (selectedDirectoryId) {
      navigate(`/documents?directoryId=${selectedDirectoryId}`);
    } else {
      navigate('/documents');
    }
  };

  // Get selected document's directoryId (safely access with optional chaining)
  const selectedDocument = documents.find(d => d.id === watchedDocumentId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directoryId = (selectedDocument as any)?.directoryId || null;

  // Update form values when rules change
  const handleQuizRulesChange = (ruleIds: string[]) => {
    setQuizRuleIds(ruleIds);
    setValue('quizRuleIds', ruleIds);
  };

  const handleFollowupRulesChange = (ruleIds: string[]) => {
    setFollowupRuleIds(ruleIds);
    setValue('followupRuleIds', ruleIds);
  };

  useEffect(() => {
    if (preselectedDocumentId && documents.length > 0 && !watchedDocumentId) {
      const docExists = documents.find(d => d.id === preselectedDocumentId);
      if (docExists) {
        setValue('documentId', preselectedDocumentId, { shouldValidate: true });
      }
    }
  }, [preselectedDocumentId, documents, setValue, watchedDocumentId]);
  return (
    <Page showSidebar={false}>
      <div className={createQuizPageStyles.container}>
        {/* Header */}
        <header className={createQuizPageStyles.header}>
          <div className={createQuizPageStyles.headerContent}>
            <button
              onClick={handleBack}
              className={createQuizPageStyles.backButton}
            >
              <ArrowLeft size={20} />
              Back to Documents
            </button>
            <h1 className={createQuizPageStyles.title}>Create Quiz</h1>
            <div></div> {/* Spacer for centering */}
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
                  <Label>Source Document *</Label>
                  <input {...register('documentId')} type="hidden" />
                  <PreSelectedDocumentSelector
                    documents={documents}
                    selectedDocumentIds={watchedDocumentId ? [watchedDocumentId] : []}
                    onDocumentToggle={(id) =>
                      setValue('documentId', watchedDocumentId === id ? '' : id, {
                        shouldValidate: true,
                      })
                    }
                    maxSelections={1}
                    isLoading={isLoading}
                    disabled={isLoading}
                    initialDocumentId={preselectedDocumentId}
                  />
                  {errors.documentId && (
                    <p className="text-sm text-destructive">{errors.documentId.message}</p>
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
                  {watchedDocumentId && !watchedQuizName?.trim() && (
                    <p className="text-sm text-muted-foreground">
                      Default name: "Quiz from {documents.find(d => d.id === watchedDocumentId)?.title}"
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

                {/* Quiz Rules */}
                {directoryId && (
                  <div className={createQuizPageStyles.formField}>
                    <CompactRuleSelector
                      directoryId={directoryId}
                      operation={RuleApplicability.QUIZ}
                      selectedRuleIds={quizRuleIds}
                      onSelectionChange={handleQuizRulesChange}
                      label="Quiz Generation Rules"
                    />
                  </div>
                )}

                {/* Followup Rules */}
                {directoryId && (
                  <div className={createQuizPageStyles.formField}>
                    <CompactRuleSelector
                      directoryId={directoryId}
                      operation={RuleApplicability.FOLLOWUP}
                      selectedRuleIds={followupRuleIds}
                      onSelectionChange={handleFollowupRulesChange}
                      label="Followup Explanation Rules"
                    />
                  </div>
                )}

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
                    disabled={!watchedDocumentId}
                  >
                    Generate Quiz
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