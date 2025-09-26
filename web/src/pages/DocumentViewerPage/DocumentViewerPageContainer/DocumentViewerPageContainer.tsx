import React from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Page } from '../../../components/Page';
import { ActionsDropdown } from '../../../components/ui/ActionsDropdown';
import { MarkdownRenderer } from '../../../components/MarkdownRenderer';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Brain, ArrowLeft, Download, List, X, Calendar, User, Hash } from 'lucide-react';
import { useDocumentViewerPageContext } from '../context';
import { 
  selectTocItems, 
  selectShowToc, 
  selectIsExporting 
} from '../../../store/slices/documentViewerPageSlice';

export const DocumentViewerPageContainer = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const {
    documentApi,
    contentApi,
    handlers,
    contentRef,
  } = useDocumentViewerPageContext();
  
  // Access Redux state directly
  const tocItems = useSelector(selectTocItems);
  const showToc = useSelector(selectShowToc);
  const isExporting = useSelector(selectIsExporting);

  // Early returns for loading and error states
  if (!documentId) {
    return (
      <Page showSidebar={true}>
        <Card className="m-4 border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive mb-4">No document ID provided in the URL</p>
            <Button 
              variant="outline"
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  if (documentApi.isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          <span className="ml-3 text-muted-foreground">Loading document...</span>
        </div>
      </Page>
    );
  }

  if (documentApi.error || !documentApi.data) {
    return (
      <Page showSidebar={true}>
        <Card className="m-4 border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive mb-2">Error loading document</p>
            <p className="text-sm text-muted-foreground mb-4">
              {documentApi.error ? JSON.stringify(documentApi.error) : 'Document not found'}
            </p>
            <Button 
              variant="outline"
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Go Back
          </Button>
          
          <div className="flex items-center gap-2">
            {/* TOC Toggle */}
            {tocItems.length > 0 && (
              <Button
                variant={showToc ? "default" : "outline"}
                size="sm"
                onClick={handlers.handleToggleToc}
              >
                <List size={16} className="mr-2" />
                {showToc ? 'Hide TOC' : 'Show TOC'}
              </Button>
            )}
            
            {/* Export PDF */}
            {contentApi.data?.content && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlers.handleExportPDF}
                disabled={isExporting}
              >
                <Download size={16} className="mr-2" />
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </Button>
            )}
            
            {/* Actions Dropdown */}
            <ActionsDropdown
              items={[
                {
                  id: 'create-quiz',
                  label: 'Create Quiz',
                  icon: <Brain size={16} />,
                  onClick: () => documentId && handlers.handleCreateQuizFromDocument(documentId),
                },
              ]}
            />
          </div>
        </div>

        {/* Document Info */}
        <Card>
          <CardHeader>
            <CardTitle>{documentApi.data.title}</CardTitle>
            {documentApi.data.description && (
              <p className="text-muted-foreground">{documentApi.data.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                Created: {new Date(documentApi.data.created).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                Updated: {new Date(documentApi.data.updated).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <User size={14} />
                Author: {documentApi.data.author}
              </span>
              <span className="flex items-center gap-1">
                <Hash size={14} />
                ID: {documentApi.data.id}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="flex gap-6">
          {/* TOC Sidebar */}
          {showToc && tocItems.length > 0 && (
            <div className="w-64 flex-shrink-0">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Table of Contents</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlers.handleToggleToc}
                      className="h-6 w-6 p-0"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <nav className="space-y-1">
                    {tocItems.map((item) => (
                      <Button
                        key={item.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => handlers.handleTocItemClick(item.id)}
                        className="w-full justify-start text-sm font-normal h-auto py-1"
                        style={{ paddingLeft: `${(item.level - 1) * 0.75 + 0.5}rem` }}
                      >
                        {item.text}
                      </Button>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <Card ref={contentRef}>
              <CardContent className="p-6">
                {contentApi.isLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    <span className="ml-3 text-muted-foreground">Loading document content...</span>
                  </div>
                ) : contentApi.error ? (
                  <div className="text-center py-12">
                    <p className="text-destructive mb-4">Failed to load document content</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {JSON.stringify(contentApi.error)}
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => contentApi.refetch()}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : contentApi.data?.content ? (
                  <MarkdownRenderer
                    content={contentApi.data.content}
                    onTocGenerated={handlers.handleTocGenerated}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="mb-4">No content available</p>
                    {documentApi.data?.description && (
                      <Card className="mt-4 text-left">
                        <CardHeader>
                          <CardTitle className="text-base">Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p>{documentApi.data.description}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Page>
  );
};