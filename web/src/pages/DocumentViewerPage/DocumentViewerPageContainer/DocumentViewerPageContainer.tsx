import React from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Page } from '../../../components/Page';
import { ActionsDropdown } from '../../../components/ui/ActionsDropdown';
import { MarkdownRenderer, TocItem } from '../../../components/MarkdownRenderer';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Brain, ArrowLeft, Download, List, X, Calendar } from 'lucide-react';
import { useDocumentViewerPageContext } from '../context';
import { 
  selectTocItems, 
  selectShowToc, 
  selectIsExporting 
} from '../../../store/slices/documentViewerPageSlice';
import { formatDateWithOptions } from '../../../utils/dateUtils';

// Recursive component to render nested TOC items
const TocItemComponent: React.FC<{
  item: TocItem;
  onItemClick: (id: string) => void;
  depth?: number;
}> = ({ item, onItemClick, depth = 0 }) => {
  const getTextSize = (level: number) => {
    switch (level) {
      case 1: return "text-sm font-medium";
      case 2: return "text-sm font-normal";
      case 3: return "text-xs font-normal";
      default: return "text-xs font-light";
    }
  };

  const getOpacity = (depth: number) => {
    return depth > 2 ? "opacity-75" : "opacity-100";
  };

  return (
    <div className="space-y-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onItemClick(item.id)}
        className={`w-full justify-start h-auto py-1.5 px-2 hover:bg-muted/70 transition-colors ${getTextSize(item.level)} ${getOpacity(depth)}`}
        style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
      >
        <span className="truncate text-left leading-relaxed">{item.title}</span>
      </Button>
      {item.children && item.children.length > 0 && (
        <div className="space-y-0.5">
          {item.children.map((child) => (
            <TocItemComponent
              key={child.id}
              item={child}
              onItemClick={onItemClick}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b">
          <div className="flex items-center justify-between p-4">
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
        </div>

        {/* Document Info */}
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold leading-tight">
                {documentApi.data.title}
              </CardTitle>
              {documentApi.data.description && (
                <p className="text-muted-foreground text-base leading-relaxed">
                  {documentApi.data.description}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                Created {formatDateWithOptions(documentApi.data.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                Updated {formatDateWithOptions(documentApi.data.updatedAt)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="flex gap-6 relative">
          {/* TOC Sidebar */}
          {showToc && tocItems.length > 0 && (
            <div className="w-72 flex-shrink-0 hidden lg:block">
              <Card className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-hidden border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Table of Contents</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlers.handleToggleToc}
                      className="h-6 w-6 p-0 hover:bg-muted"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 overflow-y-auto max-h-[calc(100vh-12rem)] scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  <nav className="space-y-0.5">
                    {tocItems.map((item) => (
                      <TocItemComponent
                        key={item.id}
                        item={item}
                        onItemClick={handlers.handleTocItemClick}
                      />
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Mobile TOC Overlay */}
          {showToc && tocItems.length > 0 && (
            <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
              <div className="fixed left-4 top-20 bottom-4 w-80 max-w-[calc(100vw-2rem)]">
                <Card className="h-full overflow-hidden border shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">Table of Contents</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlers.handleToggleToc}
                        className="h-6 w-6 p-0 hover:bg-muted"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                    <nav className="space-y-0.5">
                      {tocItems.map((item) => (
                        <TocItemComponent
                          key={item.id}
                          item={item}
                          onItemClick={(id) => {
                            handlers.handleTocItemClick(id);
                            handlers.handleToggleToc(); // Close TOC on mobile after clicking
                          }}
                        />
                      ))}
                    </nav>
                  </CardContent>
                </Card>
              </div>
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