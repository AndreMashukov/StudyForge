import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCreateFlashcardPageContext } from '../context/hooks/useCreateFlashcardPageContext';
import { selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Textarea } from '../../../components/ui/Textarea';
import { CompactRuleSelector } from '../../../components/CompactRuleSelector';
import { PreSelectedDocumentSelector } from '../../../components/PreSelectedDocumentSelector';
import { createFlashcardPageStyles } from './CreateFlashcardPageContainer.styles';
import { ArrowLeft, Layers } from 'lucide-react';
import { RuleApplicability } from '@shared-types';

export const CreateFlashcardPageContainer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDocumentId = searchParams.get('documentId') ?? undefined;
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);
  const [ruleIds, setRuleIds] = useState<string[]>([]);

  const { 
    documentsApi,
    form,
    handlers 
  } = useCreateFlashcardPageContext();

  const { 
    handleSubmit, 
    isSubmitting 
  } = handlers;

  const { data: documentsResponse, isLoading } = documentsApi;
  const documents = documentsResponse?.documents || [];
  const { register, watch, setValue, formState: { errors } } = form;
  const watchedDocumentId = watch('documentId');
  const watchedFlashcardName = watch('flashcardName');

  const handleBack = () => {
    if (selectedDirectoryId) {
      navigate(`/documents?directoryId=${selectedDirectoryId}`);
    } else {
      navigate('/documents');
    }
  };

  const selectedDocument = documents.find(d => d.id === watchedDocumentId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directoryId = (selectedDocument as any)?.directoryId || null;

  const handleRulesChange = (selectedRuleIds: string[]) => {
    setRuleIds(selectedRuleIds);
    setValue('ruleIds', selectedRuleIds);
  };

  // useRef guard: apply preselection exactly once on mount
  // Prevents overwriting user's manual selection on subsequent documents refetch
  const preselectionApplied = useRef(false);
  useEffect(() => {
    if (preselectedDocumentId && documents.length > 0 && !preselectionApplied.current) {
      const docExists = documents.find(d => d.id === preselectedDocumentId);
      if (docExists) {
        preselectionApplied.current = true;
        setValue('documentId', preselectedDocumentId, { shouldValidate: true });
      }
    }
  }, [preselectedDocumentId, documents, setValue]);
  return (
    <Page showSidebar={false}>
      <div className={createFlashcardPageStyles.container}>
        <header className={createFlashcardPageStyles.header}>
          <div className={createFlashcardPageStyles.headerContent}>
            <button
              onClick={handleBack}
              className={createFlashcardPageStyles.backButton}
            >
              <ArrowLeft size={20} />
              Back to Documents
            </button>
            <h1 className={createFlashcardPageStyles.title}>Create Flashcards</h1>
            <div></div>
          </div>
        </header>

        <div className={createFlashcardPageStyles.content}>
          <Card className={createFlashcardPageStyles.formCard}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers size={24} />
                Flashcard Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Document Selection */}
                <div className={createFlashcardPageStyles.formField}>
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

                {/* Flashcard Set Name */}
                <div className={createFlashcardPageStyles.formField}>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="flashcardName">Flashcard Set Name (Optional)</Label>
                    <span className="text-xs text-muted-foreground">
                      {watchedFlashcardName?.length || 0}/100 characters
                    </span>
                  </div>
                  <Input
                    {...register('flashcardName')}
                    id="flashcardName"
                    type="text"
                    placeholder="Leave empty for auto-generated name"
                    maxLength={100}
                  />
                  {errors.flashcardName && (
                    <p className="text-sm text-destructive">{errors.flashcardName.message}</p>
                  )}
                  {watchedDocumentId && !watchedFlashcardName?.trim() && (
                    <p className="text-sm text-muted-foreground">
                      Default name: &quot;Flashcards for {documents.find(d => d.id === watchedDocumentId)?.title}&quot;
                    </p>
                  )}
                </div>

                {/* Additional Prompt */}
                <div className={createFlashcardPageStyles.formField}>
                  <Textarea
                    {...register('additionalPrompt')}
                    id="additionalPrompt"
                    label="Additional Instructions (Optional)"
                    placeholder="e.g., Focus on key definitions, include code examples, make cards more detailed, etc."
                    showCharCount={true}
                    maxLength={500}
                    helperText="Provide specific instructions to customize your flashcard generation"
                    rows={4}
                  />
                  {errors.additionalPrompt && (
                    <p className="text-sm text-destructive">{errors.additionalPrompt.message}</p>
                  )}
                </div>

                {/* Flashcard Rules */}
                {directoryId && (
                  <div className={createFlashcardPageStyles.formField}>
                    <CompactRuleSelector
                      directoryId={directoryId}
                      operation={RuleApplicability.FLASHCARD}
                      selectedRuleIds={ruleIds}
                      onSelectionChange={handleRulesChange}
                      label="Flashcard Generation Rules"
                    />
                  </div>
                )}

                {/* Form Actions */}
                <div className={createFlashcardPageStyles.formActions}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className={createFlashcardPageStyles.cancelButton}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={createFlashcardPageStyles.submitButton}
                    disabled={isSubmitting || !watchedDocumentId}
                  >
                    {isSubmitting ? 'Generating Flashcards...' : 'Generate Flashcards'}
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
