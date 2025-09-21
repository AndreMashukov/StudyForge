import React from 'react';
import { useParams } from 'react-router-dom';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useGetDocumentQuery } from '../../../store/api/Documents';
import { ArrowLeft, Brain, Calendar, FileText } from 'lucide-react';

export const DocumentViewerPageContainer = () => {
  const { documentId } = useParams<{ documentId: string }>();
  
  const { data: document, isLoading, error } = useGetDocumentQuery(documentId || '', {
    skip: !documentId,
  });

  // Early returns for loading and error states
  if (isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </Page>
    );
  }

  if (error || !document) {
    return (
      <Page showSidebar={true}>
        <Card className="m-4 border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">Error loading document</p>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back
          </Button>
          <Button className="flex items-center gap-2">
            <Brain size={16} />
            Create Quiz
          </Button>
        </div>

        {/* Document Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{document.title}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText size={14} />
                {document.wordCount} words
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {new Date(document.createdAt).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                {document.sourceType === 'url' ? '🌐 URL' : '📁 Upload'}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Simple markdown content display for now */}
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap">{document.content}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
};