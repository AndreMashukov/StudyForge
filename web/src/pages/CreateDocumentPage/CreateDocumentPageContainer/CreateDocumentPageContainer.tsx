import React, { useState } from 'react';
import { useCreateDocumentPageContext } from '../context/hooks/useCreateDocumentPageContext';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/Tabs';
import { createDocumentPageStyles } from './CreateDocumentPageContainer.styles';
import { Globe, Upload, ArrowLeft } from 'lucide-react';
import { UrlScrapingForm } from '../components/UrlScrapingForm';
import { FileUploadForm } from '../components/FileUploadForm';

export const CreateDocumentPageContainer = () => {
  const { 
    handlers 
  } = useCreateDocumentPageContext();
  
  const { isLoading, error } = handlers;
  
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');

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
              Add content from a URL or upload a markdown file
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
        <Card className={createDocumentPageStyles.mainCard}>
          <CardHeader>
            <CardTitle>Choose Content Source</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'url' | 'upload')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Globe size={16} />
                  From URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload size={16} />
                  Upload File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="mt-0">
                <UrlScrapingForm 
                  isLoading={isLoading}
                  onSubmit={handlers.handleCreateFromUrl}
                />
              </TabsContent>

              <TabsContent value="upload" className="mt-0">
                <FileUploadForm
                  isLoading={isLoading}
                  onSubmit={handlers.handleCreateFromFile}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
};