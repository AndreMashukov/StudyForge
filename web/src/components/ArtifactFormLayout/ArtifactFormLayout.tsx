import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { selectSelectedDirectoryId } from '../../store/slices/directorySlice';
import { Page } from '../Page';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { PreSelectedDocumentSelector } from '../PreSelectedDocumentSelector';
import { RuleSelector } from '../RuleSelector';
import { ArrowLeft } from 'lucide-react';
import { IDocumentListResponse } from '../../store/api/Documents/IDocumentsApi';
import { ArtifactFormConfig } from './types';
import { artifactFormLayoutStyles } from './ArtifactFormLayout.styles';

export interface ArtifactFormLayoutProps<T extends FieldValues> {
  config: ArtifactFormConfig;
  documentsApi: {
    data?: IDocumentListResponse;
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  form: UseFormReturn<T>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
}

export const ArtifactFormLayout = <T extends FieldValues>({
  config,
  documentsApi,
  form,
  onSubmit,
  isSubmitting,
}: ArtifactFormLayoutProps<T>) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDocumentId = searchParams.get('documentId') ?? undefined;
  const directoryIdParam = searchParams.get('directoryId');
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);

  const { data: documentsResponse, isLoading, error: documentsError, refetch: refetchDocuments } = documentsApi;
  const allDocuments = useMemo(() => documentsResponse?.documents || [], [documentsResponse]);
  const resolvedDirectoryId = directoryIdParam || selectedDirectoryId;
  const documents = useMemo(
    () => resolvedDirectoryId
      ? allDocuments.filter(d => d.directoryId === resolvedDirectoryId)
      : allDocuments,
    [allDocuments, resolvedDirectoryId]
  );

  const { register, watch, setValue, formState: { errors } } = form;
  const nameFieldName = config.nameFieldName as Path<T>;
  const watchedDocumentIds = watch('documentIds' as Path<T>);
  const watchedName = watch(nameFieldName);
  const watchedRuleIds = watch('ruleIds' as Path<T>);

  const handleRuleSelectionChange = (ruleIds: string[]) => {
    setValue('ruleIds' as Path<T>, ruleIds as any);
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

  const backLabel =
    directoryIdParam || selectedDirectoryId ? 'Back' : 'Back to Documents';

  const primaryDocument = documents.find(d => d.id === (watchedDocumentIds as unknown as string[])?.[0]);

  const preselectionApplied = useRef(false);
  useEffect(() => {
    if (preselectedDocumentId && documents.length > 0 && !preselectionApplied.current) {
      const docExists = documents.find(d => d.id === preselectedDocumentId);
      if (docExists) {
        preselectionApplied.current = true;
        const current = (form.getValues('documentIds' as Path<T>) as unknown as string[]) || [];
        if (!current.includes(preselectedDocumentId)) {
          setValue('documentIds' as Path<T>, [preselectedDocumentId, ...current] as any, { shouldValidate: true });
        }
      }
    }
  }, [preselectedDocumentId, documents, setValue, form]);

  const handleDocumentToggle = (id: string) => {
    const current = (form.getValues('documentIds' as Path<T>) as unknown as string[]) || [];
    const next = current.includes(id)
      ? current.filter(d => d !== id)
      : [...current, id];
    setValue('documentIds' as Path<T>, next as any, { shouldValidate: true });
  };

  const docCount = (watchedDocumentIds as unknown as string[])?.length ?? 0;
  const generateLabel = isSubmitting
    ? config.generateLabels.submitting
    : docCount > 1
      ? config.generateLabels.plural(docCount)
      : config.generateLabels.single;

  return (
    <Page showSidebar={false}>
      <div className={artifactFormLayoutStyles.container}>
        <header className={artifactFormLayoutStyles.header}>
          <div className={artifactFormLayoutStyles.headerContent}>
            <button type="button" onClick={handleBack} className={artifactFormLayoutStyles.backButton}>
              <ArrowLeft size={20} />
              {backLabel}
            </button>
            <h1 className={artifactFormLayoutStyles.title}>{config.title}</h1>
            <div />
          </div>
        </header>

        <div className={artifactFormLayoutStyles.content}>
          <Card className={artifactFormLayoutStyles.formCard}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {config.cardIcon}
                {config.cardTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-6">
                {/* Document Selection */}
                <div className={artifactFormLayoutStyles.formField}>
                  <Label>Source Documents *</Label>
                  {documentsError ? (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 space-y-2">
                      <p className="text-sm text-destructive">Failed to load documents.</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => refetchDocuments()}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <PreSelectedDocumentSelector
                      documents={documents}
                      selectedDocumentIds={(watchedDocumentIds as unknown as string[]) ?? []}
                      onDocumentToggle={handleDocumentToggle}
                      maxSelections={5}
                      isLoading={isLoading}
                      disabled={isLoading}
                      initialDocumentId={preselectedDocumentId}
                    />
                  )}
                  {errors.documentIds && (
                    <p className="text-sm text-destructive">
                      {String(errors.documentIds.message ?? 'Please select at least one document')}
                    </p>
                  )}
                </div>

                {/* Artifact Name */}
                <div className={artifactFormLayoutStyles.formField}>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor={config.nameFieldName}>{config.nameFieldLabel} (Optional)</Label>
                    <span className="text-xs text-muted-foreground">
                      {(watchedName as unknown as string)?.length || 0}/100 characters
                    </span>
                  </div>
                  <Input
                    {...register(nameFieldName)}
                    id={config.nameFieldName}
                    type="text"
                    placeholder="Leave empty for auto-generated name"
                    maxLength={100}
                  />
                  {errors[nameFieldName] && (
                    <p className="text-sm text-destructive">{(errors[nameFieldName] as any)?.message}</p>
                  )}
                  {docCount > 0 && !(watchedName as unknown as string)?.trim() && config.defaultNameFn && primaryDocument && (
                    <p className="text-sm text-muted-foreground">
                      Default name: &quot;{config.defaultNameFn(primaryDocument.title)}&quot;
                    </p>
                  )}
                </div>

                {/* Additional Prompt */}
                <div className={artifactFormLayoutStyles.formField}>
                  <Textarea
                    {...register('additionalPrompt' as Path<T>)}
                    id="additionalPrompt"
                    label="Additional Instructions (Optional)"
                    placeholder={config.additionalPromptPlaceholder}
                    showCharCount={true}
                    maxLength={500}
                    helperText={config.additionalPromptHelperText}
                    rows={4}
                  />
                  {errors.additionalPrompt && (
                    <p className="text-sm text-destructive">{String(errors.additionalPrompt.message)}</p>
                  )}
                </div>

                {/* Rules */}
                {resolvedDirectoryId && (
                  <RuleSelector
                    directoryId={resolvedDirectoryId}
                    operation={config.ruleApplicability}
                    selectedRuleIds={(watchedRuleIds as unknown as string[]) ?? []}
                    onSelectionChange={handleRuleSelectionChange}
                  />
                )}

                {/* Form Actions */}
                <div className={artifactFormLayoutStyles.formActions}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className={artifactFormLayoutStyles.cancelButton}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={artifactFormLayoutStyles.submitButton}
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
