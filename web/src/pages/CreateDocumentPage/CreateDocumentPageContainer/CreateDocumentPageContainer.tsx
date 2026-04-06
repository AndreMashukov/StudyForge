import React from 'react';
import { useSelector } from 'react-redux';
import { useCreateDocumentPageContext } from '../context/hooks/useCreateDocumentPageContext';
import { Page } from '../../../components/Page';
import { Button } from '../../../components/ui/Button';
import { createDocumentPageStyles } from './CreateDocumentPageContainer.styles';
import { ArrowLeft } from 'lucide-react';
import { SourceListPanel } from './SourceListPanel';
import { FormRenderer } from './FormRenderer';
import {
  selectSelectedSource,
  selectCreateDocumentPageError,
} from '../../../store/slices/createDocumentPageSlice';
import { Card, CardContent } from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';
import type { RootState } from '../../../store';

export const CreateDocumentPageContainer = () => {
  const { handlers } = useCreateDocumentPageContext();
  
  // Redux selectors
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));
  const error = useSelector((state: RootState) => selectCreateDocumentPageError(state));
  
  const isFormVisible = Boolean(selectedSource);

  return (
    <Page showSidebar={true}>
      <div className={createDocumentPageStyles.container}>
        {/* Header */}
        <div className={createDocumentPageStyles.header}>
          <Button
            variant="outline"
            onClick={handlers.handleGoBack}
            className={createDocumentPageStyles.backButton}
          >
            <ArrowLeft size={16} />
            Back to Documents
          </Button>
          <div className={createDocumentPageStyles.headerContent}>
            <h1 className={createDocumentPageStyles.title}>Create Document</h1>
            <p className={createDocumentPageStyles.subtitle}>
              {isFormVisible
                ? 'Configure your document source and create your content'
                : 'Choose a source type to get started'
              }
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive mb-6">
            <CardContent className="p-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Split Layout */}
        <div className={createDocumentPageStyles.splitLayout}>
          {/* Left: Source List Panel */}
          <SourceListPanel />

          {/* Right: Form Panel */}
          <div className={createDocumentPageStyles.formPanel}>
            {isFormVisible ? (
              <FormRenderer />
            ) : (
              <div className={createDocumentPageStyles.emptyState}>
                <div className={createDocumentPageStyles.emptyStateIcon}>📝</div>
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
    </Page>
  );
};
