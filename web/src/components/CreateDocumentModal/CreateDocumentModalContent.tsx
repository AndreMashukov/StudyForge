import React from 'react';
import { useSelector } from 'react-redux';
import { useCreateDocumentPageContext } from '../../pages/CreateDocumentPage/context/hooks/useCreateDocumentPageContext';
import { SourceListPanel } from '../../pages/CreateDocumentPage/CreateDocumentPageContainer/SourceListPanel';
import { FormRenderer } from '../../pages/CreateDocumentPage/CreateDocumentPageContainer/FormRenderer';
import { createDocumentPageStyles } from '../../pages/CreateDocumentPage/CreateDocumentPageContainer/CreateDocumentPageContainer.styles';
import {
  selectSelectedSource,
  selectCreateDocumentPageError,
} from '../../store/slices/createDocumentPageSlice';
import { Card, CardContent } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RootState } from '../../store';

export const CreateDocumentModalContent: React.FC = () => {
  const { isReady = false } = useCreateDocumentPageContext();
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));
  const error = useSelector((state: RootState) => selectCreateDocumentPageError(state));
  const isFormVisible = Boolean(selectedSource);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {error ? (
        <div className="shrink-0 px-4 pt-4">
          <Card className="border-destructive">
            <CardContent className="p-4">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div
        className={cn(
          createDocumentPageStyles.splitLayout,
          'min-h-0 flex-1 overflow-y-auto p-4',
        )}
      >
        <SourceListPanel />

        <div className={createDocumentPageStyles.formPanel}>
          {!isReady ? (
            <div className="flex h-full min-h-[280px] items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : isFormVisible ? (
            <FormRenderer />
          ) : (
            <div className={createDocumentPageStyles.emptyState}>
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
              <h3 className={createDocumentPageStyles.emptyStateTitle}>
                Select a source type
              </h3>
              <p className={createDocumentPageStyles.emptyStateDesc}>
                Choose a source type from the panel on the left to start creating your document.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
