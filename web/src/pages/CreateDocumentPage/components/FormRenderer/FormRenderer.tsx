import React from 'react';
import { useSelector } from 'react-redux';
import { selectSelectedSource } from '../../../../store/slices/createDocumentPageSlice';
import { UrlScrapingForm } from '../UrlScrapingForm';
import { FileUploadForm } from '../FileUploadForm';
import { FormContainer } from '../FormContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Globe, Upload, ArrowLeft } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { IUrlScrapingFormData } from '../UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../FileUploadForm/IFileUploadForm';
import type { RootState } from '../../../../store';

interface IFormRendererProps {
  onSubmitUrl: (data: IUrlScrapingFormData) => Promise<void>;
  onSubmitFile: (data: IFileUploadFormData) => Promise<void>;
  isUrlLoading: boolean;
  isFileLoading: boolean;
  onBack?: () => void;
}

const getFormIcon = (sourceType: string) => {
  switch (sourceType) {
    case 'website':
      return <Globe size={20} />;
    case 'file':
      return <Upload size={20} />;
    default:
      return null;
  }
};

const getFormTitle = (sourceType: string) => {
  switch (sourceType) {
    case 'website':
      return 'Website Content Scraper';
    case 'file':
      return 'File Upload Center';
    default:
      return 'Create Document';
  }
};

export const FormRenderer = ({
  onSubmitUrl,
  onSubmitFile,
  isUrlLoading,
  isFileLoading,
  onBack,
}: IFormRendererProps) => {
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));

  if (!selectedSource) {
    return null;
  }

  return (
    <FormContainer>
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="hover:bg-muted"
              >
                <ArrowLeft size={16} />
              </Button>
            )}
            <div className="flex items-center gap-2">
              {getFormIcon(selectedSource)}
              <CardTitle className="text-lg">
                {getFormTitle(selectedSource)}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {selectedSource === 'website' && (
            <UrlScrapingForm
              isLoading={isUrlLoading}
              onSubmit={onSubmitUrl}
            />
          )}
          
          {selectedSource === 'file' && (
            <FileUploadForm
              isLoading={isFileLoading}
              onSubmit={onSubmitFile}
            />
          )}
          
          {(selectedSource === 'textPrompt' || selectedSource === 'videoUrl') && (
            <div className="text-center py-12">
              <span role="img" aria-label="Under construction" className="text-4xl mb-4 block">
                🚧
              </span>
              <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
              <p className="text-muted-foreground">
                This feature is currently under development and will be available soon.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </FormContainer>
  );
};