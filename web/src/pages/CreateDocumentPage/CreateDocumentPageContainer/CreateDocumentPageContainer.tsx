import React from 'react';
import { useSelector } from 'react-redux';
import { useCreateDocumentPageContext } from '../context/hooks/useCreateDocumentPageContext';
import { Page } from '../../../components/Page';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { createDocumentPageStyles } from './CreateDocumentPageContainer.styles';
import { ArrowLeft } from 'lucide-react';
import { SourceSelector } from './SourceSelector';
import { FormRenderer } from './FormRenderer';
import { 
  selectSelectedSource, 
  selectCreateDocumentPageError,
  selectUrlFormLoading,
  selectFileFormLoading,
  clearSelection 
} from '../../../store/slices/createDocumentPageSlice';
import { useDispatch } from 'react-redux';
import { cn } from '../../../lib/utils';
import type { RootState } from '../../../store';

export const CreateDocumentPageContainer = () => {
  const dispatch = useDispatch();
  const { handlers } = useCreateDocumentPageContext();
  
  // Redux selectors
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));
  const error = useSelector((state: RootState) => selectCreateDocumentPageError(state));
  const isUrlLoading = useSelector((state: RootState) => selectUrlFormLoading(state));
  const isFileLoading = useSelector((state: RootState) => selectFileFormLoading(state));
  
  const isFormVisible = Boolean(selectedSource);

  const handleBackToSources = () => {
    dispatch(clearSelection());
  };

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
                : 'Choose how you\'d like to create your document'
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

        {/* Main Content */}
        <div className={createDocumentPageStyles.contentSection}>
          {/* Source Selector Section */}
          <div 
            className={cn(
              createDocumentPageStyles.sourceSelectorSection,
              createDocumentPageStyles.cardsContainer,
              isFormVisible ? createDocumentPageStyles.cardsDimmed : createDocumentPageStyles.cardsActive
            )}
          >
            <SourceSelector />
          </div>
          
          {/* Form Section */}
          <div className={createDocumentPageStyles.formSection}>
            <FormRenderer
              onSubmitUrl={handlers.handleCreateFromUrl}
              onSubmitFile={handlers.handleCreateFromFile}
              isUrlLoading={isUrlLoading}
              isFileLoading={isFileLoading}
              onBack={handleBackToSources}
            />
          </div>
        </div>
      </div>
    </Page>
  );
};