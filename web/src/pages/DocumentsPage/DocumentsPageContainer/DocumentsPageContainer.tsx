import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useDocumentsPageContext } from '../context/hooks/useDocumentsPageContext';
import { selectSearchQuery, selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import { useGetDirectoryContentsQuery } from '../../../store/api/Directory/DirectoryApi';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ActionsDropdown } from '../../../components/ui/ActionsDropdown';
import { DirectoryTree } from '../../../components/DirectoryTree';
import { BreadcrumbNav } from '../../../components/BreadcrumbNav';
import { FolderCard } from './FolderCard';
import { CreateDirectoryDialog } from './CreateDirectoryDialog';
import { EditDirectoryDialog } from './EditDirectoryDialog';
import { DeleteDirectoryDialog } from './DeleteDirectoryDialog';
import { documentsPageStyles } from './DocumentsPageContainer.styles';
import { Plus, Search, FileText, Calendar, Eye, Brain, Trash2, FolderPlus, Grid, List } from 'lucide-react';
import { DocumentEnhanced, Directory } from "@shared-types";
import { formatDate } from '../../../utils/dateUtils';

export const DocumentsPageContainer = () => {
  const { 
    documentsApi,
    handlers 
  } = useDocumentsPageContext();

  const searchQuery = useSelector(selectSearchQuery);
  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);

  // Directory contents (folders + documents in current directory)
  const { 
    data: directoryContents, 
    isLoading: isLoadingContents,
    error: contentsError 
  } = useGetDirectoryContentsQuery(selectedDirectoryId || null);

  // Local state for dialogs
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogParentId, setCreateDialogParentId] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; directory: Directory | null }>({
    open: false,
    directory: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; directory: Directory | null }>({
    open: false,
    directory: null,
  });

  const handleCreateDirectory = (parentId: string | null) => {
    setCreateDialogParentId(parentId);
    setCreateDialogOpen(true);
  };

  const isLoading = documentsApi.isLoading || isLoadingContents;
  const error = documentsApi.error || contentsError;

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
            <p className="text-destructive">Error loading content</p>
          </CardContent>
        </Card>
      </Page>
    );
  }

  const subdirectories = directoryContents?.subdirectories || [];
  const documents = directoryContents?.documents || [];

  return (
    <Page showSidebar={true}>
      <div className="flex h-full">
        {/* Left Sidebar - Directory Tree */}
        <div className="w-64 border-r bg-background overflow-y-auto">
          <div className="p-4">
            <DirectoryTree 
              onSelectDirectory={handlers.handleSelectDirectory}
              onCreateDirectory={handleCreateDirectory}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className={documentsPageStyles.container}>
            {/* Breadcrumb Navigation */}
            <BreadcrumbNav
              directoryId={selectedDirectoryId}
              onNavigate={(directoryId) => handlers.handleSelectDirectory(directoryId)}
              className="px-6 pt-6"
            />

            {/* Header */}
            <div className={documentsPageStyles.header}>
              <div className={documentsPageStyles.headerContent}>
                <h1 className={documentsPageStyles.title}>
                  {selectedDirectoryId ? directoryContents?.directory.name : 'All Documents'}
                </h1>
                <p className={documentsPageStyles.subtitle}>
                  {subdirectories.length} folder(s), {documents.length} document(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleCreateDirectory(selectedDirectoryId)}
                >
                  <FolderPlus size={16} />
                  New Folder
                </Button>
                <Button
                  onClick={handlers.handleCreateDocument}
                  className={documentsPageStyles.createButton}
                >
                  <Plus size={16} />
                  Create Document
                </Button>
              </div>
            </div>

            {/* Search and View Controls */}
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
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid size={16} />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List size={16} />
                </Button>
              </div>
            </div>

            {/* Empty State */}
            {subdirectories.length === 0 && documents.length === 0 && (
              <Card className={documentsPageStyles.emptyState}>
                <CardContent className="text-center p-8">
                  <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    {selectedDirectoryId ? 'Empty folder' : 'No documents yet'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {selectedDirectoryId 
                      ? 'Add documents or create subfolders to organize your content'
                      : 'Create your first document from a URL or by uploading a markdown file'
                    }
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => handleCreateDirectory(selectedDirectoryId)}>
                      <FolderPlus size={16} />
                      New Folder
                    </Button>
                    <Button onClick={handlers.handleCreateDocument}>
                      <Plus size={16} />
                      Create Document
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Folders Grid */}
            {subdirectories.length > 0 && (
              <div className="px-6">
                <h2 className="text-lg font-semibold mb-3">Folders</h2>
                <div className={documentsPageStyles.documentsGrid}>
                  {subdirectories.map((dir: Directory) => (
                    <FolderCard
                      key={dir.id}
                      directory={dir}
                      onClick={() => handlers.handleSelectDirectory(dir.id)}
                      onEdit={() => setEditDialog({ open: true, directory: dir })}
                      onDelete={() => setDeleteDialog({ open: true, directory: dir })}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Documents Grid */}
            {documents.length > 0 && (
              <div className="px-6 mt-6">
                <h2 className="text-lg font-semibold mb-3">Documents</h2>
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
                          <div className="text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                              {document.sourceType === 'url' ? '🌐 URL' : '📁 Upload'}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {document.description || `Document with ${document.wordCount} words`}
                          </p>
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
                            <ActionsDropdown
                              items={[
                                {
                                  id: 'create-quiz',
                                  label: 'Create Quiz',
                                  icon: <Brain size={14} />,
                                  onClick: () => handlers.handleCreateQuizFromDocument(document.id),
                                },
                              ]}
                              className="flex-1"
                            />
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateDirectoryDialog
        isOpen={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setCreateDialogParentId(null);
        }}
        parentId={createDialogParentId}
        onSuccess={(directoryId) => {
          // Optionally navigate to the new directory
          handlers.handleSelectDirectory(directoryId);
          setCreateDialogParentId(null);
        }}
      />

      <EditDirectoryDialog
        isOpen={editDialog.open}
        onClose={() => setEditDialog({ open: false, directory: null })}
        directory={editDialog.directory}
        onSuccess={() => {
          // Refetch is handled automatically by RTK Query
        }}
      />

      <DeleteDirectoryDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, directory: null })}
        directory={deleteDialog.directory}
        onSuccess={() => {
          // Refetch is handled automatically by RTK Query
        }}
      />
    </Page>
  );
};