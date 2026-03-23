import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCreateSlideDeckPageContext } from '../context/hooks/useCreateSlideDeckPageContext';
import { selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Textarea } from '../../../components/ui/Textarea';
import { PreSelectedDocumentSelector } from '../../../components/PreSelectedDocumentSelector';
import { createSlideDeckPageStyles } from './CreateSlideDeckPageContainer.styles';
import { ArrowLeft, Presentation } from 'lucide-react';

export const CreateSlideDeckPageContainer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDocumentId = searchParams.get('documentId') ?? undefined;
  const directoryIdParam = searchParams.get('directoryId');
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);

  const { documentsApi, form, handlers } = useCreateSlideDeckPageContext();
  const { handleSubmit, isSubmitting } = handlers;

  const { data: documentsResponse, isLoading } = documentsApi;
  const documents = useMemo(() => documentsResponse?.documents || [], [documentsResponse]);
  const { register, watch, setValue, formState: { errors } } = form;

  const watchedDocumentIds = watch('documentIds');
  const watchedSlideDeckName = watch('slideDeckName');

  const handleBack = () => {
    if (directoryIdParam) {
      navigate(`/directory/${directoryIdParam}`);
    } else if (selectedDirectoryId) {
      navigate(`/directory/${selectedDirectoryId}`);
    } else {
      navigate('/documents');
    }
  };

  const backLabel =
    directoryIdParam || selectedDirectoryId ? 'Back' : 'Back to Documents';

  const primaryDocument = documents.find(d => d.id === watchedDocumentIds?.[0]);

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
  const generateLabel = isSubmitting
    ? 'Generating Slide Deck...'
    : docCount > 1
      ? `Generate Slide Deck from ${docCount} documents`
      : 'Generate Slide Deck';

  return (
    <Page showSidebar={false}>
      <div className={createSlideDeckPageStyles.container}>
        <header className={createSlideDeckPageStyles.header}>
          <div className={createSlideDeckPageStyles.headerContent}>
            <button type="button" onClick={handleBack} className={createSlideDeckPageStyles.backButton}>
              <ArrowLeft size={20} />
              {backLabel}
            </button>
            <h1 className={createSlideDeckPageStyles.title}>Create Slide Deck</h1>
            <div></div>
          </div>
        </header>

        <div className={createSlideDeckPageStyles.content}>
          <Card className={createSlideDeckPageStyles.formCard}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Presentation size={24} />
                Slide Deck Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Document Selection */}
                <div className={createSlideDeckPageStyles.formField}>
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

                {/* Slide Deck Name */}
                <div className={createSlideDeckPageStyles.formField}>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="slideDeckName">Slide Deck Name (Optional)</Label>
                    <span className="text-xs text-muted-foreground">
                      {watchedSlideDeckName?.length || 0}/100 characters
                    </span>
                  </div>
                  <Input
                    {...register('slideDeckName')}
                    id="slideDeckName"
                    type="text"
                    placeholder="Leave empty for auto-generated name"
                    maxLength={100}
                  />
                  {errors.slideDeckName && (
                    <p className="text-sm text-destructive">{errors.slideDeckName.message}</p>
                  )}
                  {docCount > 0 && !watchedSlideDeckName?.trim() && (
                    <p className="text-sm text-muted-foreground">
                      Default name: &quot;Slides for {primaryDocument?.title}&quot;
                    </p>
                  )}
                </div>

                {/* Additional Prompt */}
                <div className={createSlideDeckPageStyles.formField}>
                  <Textarea
                    {...register('additionalPrompt')}
                    id="additionalPrompt"
                    label="Additional Instructions (Optional)"
                    placeholder="e.g., Focus on architecture diagrams, keep slides concise, use more visuals, etc."
                    showCharCount={true}
                    maxLength={500}
                    helperText="Provide specific instructions to customize your slide deck generation"
                    rows={4}
                  />
                  {errors.additionalPrompt && (
                    <p className="text-sm text-destructive">{errors.additionalPrompt.message}</p>
                  )}
                </div>

                {/* Form Actions */}
                <div className={createSlideDeckPageStyles.formActions}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className={createSlideDeckPageStyles.cancelButton}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={createSlideDeckPageStyles.submitButton}
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
