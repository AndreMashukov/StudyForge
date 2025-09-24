import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateQuizPageContext } from '../context/hooks/useCreateQuizPageContext';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Textarea } from '../../../components/ui/Textarea';
import { createQuizPageStyles } from './CreateQuizPageContainer.styles';
import { ArrowLeft, Brain } from 'lucide-react';

export const CreateQuizPageContainer = () => {
  const navigate = useNavigate();

  const { 
    documentsApi,
    form,
    handlers 
  } = useCreateQuizPageContext();

  const { 
    handleSubmit, 
    isSubmitting 
  } = handlers;

  const { data: documentsResponse, isLoading } = documentsApi;
  const documents = documentsResponse?.documents || [];
  const { register, watch, formState: { errors } } = form;
  const watchedDocumentId = watch('documentId');
  const watchedQuizName = watch('quizName');

  const handleBack = () => {
    navigate('/documents');
  };

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

                {/* Form Actions */}
                <div className={createQuizPageStyles.formActions}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className={createQuizPageStyles.cancelButton}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={createQuizPageStyles.submitButton}
                    disabled={isSubmitting || !watchedDocumentId}
                  >
                    {isSubmitting ? 'Generating Quiz...' : 'Generate Quiz'}
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