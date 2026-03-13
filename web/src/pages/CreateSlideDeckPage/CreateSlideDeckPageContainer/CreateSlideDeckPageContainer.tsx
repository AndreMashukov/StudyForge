import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCreateSlideDeckPageContext } from '../context/hooks/useCreateSlideDeckPageContext';
import { selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Textarea } from '../../../components/ui/Textarea';
import { CompactRuleSelector } from '../../../components/CompactRuleSelector';
import { createSlideDeckPageStyles } from './CreateSlideDeckPageContainer.styles';
import { ArrowLeft, Presentation } from 'lucide-react';
import { RuleApplicability } from '@shared-types';

export const CreateSlideDeckPageContainer = () => {
  const navigate = useNavigate();
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);
  const [ruleIds, setRuleIds] = useState<string[]>([]);

  const {
    documentsApi,
    form,
    handlers
  } = useCreateSlideDeckPageContext();

  const {
    handleSubmit,
    isSubmitting
  } = handlers;

  const { data: documentsResponse, isLoading } = documentsApi;
  const documents = documentsResponse?.documents || [];
  const { register, watch, setValue, formState: { errors } } = form;
  const watchedDocumentId = watch('documentId');
  const watchedSlideDeckName = watch('slideDeckName');

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

  return (
    <Page showSidebar={false}>
      <div className={createSlideDeckPageStyles.container}>
        <header className={createSlideDeckPageStyles.header}>
          <div className={createSlideDeckPageStyles.headerContent}>
            <button
              onClick={handleBack}
              className={createSlideDeckPageStyles.backButton}
            >
              <ArrowLeft size={20} />
              Back to Documents
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
                  <Label htmlFor="documentId">Source Document *</Label>
                  <select
                    {...register('documentId')}
                    id="documentId"
                    className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={isLoading}
                  >
                    <option value="">Select a document</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title}
                      </option>
                    ))}
                  </select>
                  {errors.documentId && (
                    <p className="text-sm text-destructive">{errors.documentId.message}</p>
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
                  {watchedDocumentId && !watchedSlideDeckName?.trim() && (
                    <p className="text-sm text-muted-foreground">
                      Default name: &quot;Slides for {documents.find(d => d.id === watchedDocumentId)?.title}&quot;
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

                {/* Slide Deck Rules */}
                {directoryId && (
                  <div className={createSlideDeckPageStyles.formField}>
                    <CompactRuleSelector
                      directoryId={directoryId}
                      operation={RuleApplicability.SLIDE_DECK}
                      selectedRuleIds={ruleIds}
                      onSelectionChange={handleRulesChange}
                      label="Slide Deck Generation Rules"
                    />
                  </div>
                )}

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
                    disabled={isSubmitting || !watchedDocumentId}
                  >
                    {isSubmitting ? 'Generating Slide Deck...' : 'Generate Slide Deck'}
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
