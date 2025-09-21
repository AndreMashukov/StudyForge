import React from 'react';
import { useDocumentsPageContext } from '../context/hooks/useDocumentsPageContext';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { documentsPageStyles } from './DocumentsPageContainer.styles';
import { Plus, Search, FileText, Calendar, Eye, Brain, Trash2 } from 'lucide-react';
import { DocumentEnhanced } from "@shared-types";

const formatDate = (date: Date | { toDate(): Date } | string): string => {
  try {
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString();
    }
    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString();
    }
    // Fallback
    return new Date().toLocaleDateString();
  } catch (error) {
    console.warn('Error formatting date:', error, date);
    return 'Invalid date';
  }
};

export const DocumentsPageContainer = () => {
  const { 
    documents, 
    searchQuery, 
    isLoading, 
    error,
    handlers 
  } = useDocumentsPageContext();

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

  if (error) {
    return (
      <Page showSidebar={true}>
        <Card className="m-4 border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">Error loading documents</p>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className={documentsPageStyles.container}>
        {/* Header */}
        <div className={documentsPageStyles.header}>
          <div className={documentsPageStyles.headerContent}>
            <h1 className={documentsPageStyles.title}>Documents Library</h1>
            <p className={documentsPageStyles.subtitle}>
              Manage your documents and create quizzes from them
            </p>
          </div>
          <Button
            onClick={handlers.handleCreateDocument}
            className={documentsPageStyles.createButton}
          >
            <Plus size={16} />
            Create Document
          </Button>
        </div>

        {/* Search and Filter */}
        <div className={documentsPageStyles.searchContainer}>
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => handlers.handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <Card className={documentsPageStyles.emptyState}>
            <CardContent className="text-center p-8">
              <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first document from a URL or by uploading a markdown file
              </p>
              <Button onClick={handlers.handleCreateDocument}>
                <Plus size={16} />
                Create Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={documentsPageStyles.documentsGrid}>
            {documents.map((document: DocumentEnhanced) => (
              <Card key={document.id} className={documentsPageStyles.documentCard}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{document.title}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <FileText size={14} />
                          {document.wordCount} words
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(document.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Source Info */}
                    <div className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                        {document.sourceType === 'url' ? '🌐 URL' : '📁 Upload'}
                      </span>
                    </div>

                    {/* Content Preview */}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {document.description || `Document with ${document.wordCount} words`}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlers.handleViewDocument(document.id)}
                        className="flex-1"
                      >
                        <Eye size={14} />
                        View
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handlers.handleCreateQuizFromDocument(document.id)}
                        className="flex-1"
                      >
                        <Brain size={14} />
                        Create Quiz
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlers.handleDeleteDocument(document.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
};