import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useDocumentsPageContext } from '../context/hooks/useDocumentsPageContext';
import { selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import {
  useGetDirectoryContentsQuery,
  useGetDirectoryTreeQuery,
} from '../../../store/api/Directory/DirectoryApi';
import { Page } from '../../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ActionsDropdown } from '../../../components/ui/ActionsDropdown';
import { DirectoryTree } from '../../../components/DirectoryTree';
import { BreadcrumbNav } from '../../../components/BreadcrumbNav';
import { FolderCard } from './FolderCard';
import { CreateDirectoryDialog } from './CreateDirectoryDialog';
import { EditDirectoryDialog } from './EditDirectoryDialog';
import { DeleteDirectoryDialog } from './DeleteDirectoryDialog';
import { MoveDirectoryDialog } from './MoveDirectoryDialog';
import { documentsPageStyles } from './DocumentsPageContainer.styles';
import { Plus, FileText, Calendar, Eye, Brain, Trash2, FolderPlus, Menu, Layers, Presentation, Loader2 } from 'lucide-react';
import { DocumentEnhanced, Directory, getDocumentFallbackColor } from "@shared-types";
import { formatDate } from '../../../utils/dateUtils';
import {
  getDirectoryNameFromTree,
  getSubdirectoriesForParent,
} from '../../../utils/directoryTreeUtils';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { Spinner } from '../../../components/ui/Spinner';
import { IndeterminateLinearProgress } from '../../../components/ui/IndeterminateLinearProgress';
import { MascotImage } from '../../../components/MascotImage';

export const DocumentsPageContainer = (): React.JSX.Element => {
  const navigate = useNavigate();
  const { handlers } = useDocumentsPageContext();

  // Mobile state
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Auto-close mobile sidebar when switching to desktop
  React.useEffect(() => {
    if (!isMobile) {
      setIsMobileSidebarOpen(false);
    }
  }, [isMobile]);

  const selectedDirectoryId = useSelector(selectSelectedDirectoryId);

  const {
    data: treeData,
    isLoading: isLoadingTree,
  } = useGetDirectoryTreeQuery();

  const {
    data: directoryContents,
    isLoading: isLoadingContents,
    isFetching: isFetchingContents,
    error: contentsError,
  } = useGetDirectoryContentsQuery(selectedDirectoryId || null);

  // Local state for dialogs
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
  const [moveDialog, setMoveDialog] = useState<{ directory: Directory | null }>({ directory: null });

  const handleCreateDirectory = (parentId: string | null) => {
    setCreateDialogParentId(parentId);
    setCreateDialogOpen(true);
  };

  const subdirectories = useMemo(() => {
    const fromTree = getSubdirectoriesForParent(treeData?.tree, selectedDirectoryId);
    if (fromTree !== undefined) {
      return fromTree;
    }
    return directoryContents?.subdirectories ?? [];
  }, [treeData?.tree, selectedDirectoryId, directoryContents?.subdirectories]);

  const documents = directoryContents?.documents ?? [];
  const isRoot = !selectedDirectoryId;
  const isLoadingDocuments = isLoadingContents && !directoryContents;
  const showRootLoadingIndicator = isRoot && (isLoadingDocuments || isFetchingContents);
  const directoryTitle =
    (selectedDirectoryId && directoryContents?.directory.name) ||
    getDirectoryNameFromTree(treeData?.tree, selectedDirectoryId) ||
    (selectedDirectoryId ? 'Folder' : 'Root');

  const isInitialLoading =
    (isLoadingTree && !treeData) &&
    (isLoadingContents && !directoryContents);
  const error = contentsError;

  if (isInitialLoading) {
    return (
      <Page showSidebar={true}>
        <div className="flex justify-center items-center p-8">
          <Spinner size="md" />
        </div>
      </Page>
    );
  }

  if (error && !treeData && !directoryContents) {
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

  const showEmptyState =
    !isLoadingDocuments &&
    subdirectories.length === 0 &&
    documents.length === 0;

  return (
    <Page showSidebar={true}>
      <div className="flex h-full">
        {/* Mobile Sidebar Overlay */}
        {isMobile && isMobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            {/* Sidebar */}
            <div className="fixed inset-y-0 left-0 w-64 bg-background border-r z-50 overflow-y-auto">
              <div className="p-4">
                <DirectoryTree 
                  onSelectDirectory={(id) => {
                    handlers.handleSelectDirectory(id);
                    setIsMobileSidebarOpen(false);
                  }}
                  onCreateDirectory={handleCreateDirectory}
                />
              </div>
            </div>
          </>
        )}

        {/* Desktop Sidebar - Directory Tree */}
        {!isMobile && (
          <div className="w-64 border-r bg-background overflow-y-auto">
            <div className="p-4">
              <DirectoryTree 
                onSelectDirectory={handlers.handleSelectDirectory}
                onCreateDirectory={handleCreateDirectory}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className={documentsPageStyles.container}>
            {/* Mobile Header with Menu Button */}
            {isMobile && (
              <div className="px-4 pt-4 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="mb-2"
                >
                  <Menu size={16} />
                  Folders
                </Button>
              </div>
            )}

            {/* Breadcrumb Navigation */}
            <BreadcrumbNav
              directoryId={selectedDirectoryId}
              onNavigate={(directoryId) => handlers.handleSelectDirectory(directoryId)}
              className="px-4 md:px-6 pt-4 md:pt-6"
            />

            {/* Header */}
            <div className={documentsPageStyles.header}>
              <div className={documentsPageStyles.headerRow}>
                <div className={documentsPageStyles.headerContent}>
                  <h1 className={documentsPageStyles.title}>
                    {directoryTitle}
                  </h1>
                  {!isRoot && (
                    <p className={documentsPageStyles.subtitle}>
                      {subdirectories.length} folder(s),{' '}
                      {isLoadingDocuments ? '…' : documents.length} document(s)
                      {(isFetchingContents || isLoadingDocuments) && (directoryContents || treeData) && (
                        <Loader2
                          className="inline-block ml-2 h-3.5 w-3.5 animate-spin text-muted-foreground"
                          aria-label="Refreshing"
                        />
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleCreateDirectory(selectedDirectoryId)}
                    className="w-full sm:w-auto gap-2"
                  >
                    <FolderPlus size={16} />
                    <span className="hidden sm:inline">New Folder</span>
                    <span className="sm:hidden">Folder</span>
                  </Button>
                  {selectedDirectoryId && (
                    <Button
                      onClick={handlers.handleCreateDocument}
                      className={documentsPageStyles.createButton}
                    >
                      <Plus size={16} />
                      <span className="hidden sm:inline">Create Document</span>
                      <span className="sm:hidden">Document</span>
                    </Button>
                  )}
                </div>
              </div>
              {showRootLoadingIndicator && <IndeterminateLinearProgress />}
            </div>

            {/* Empty State */}
            {showEmptyState && (
              <Card className={documentsPageStyles.emptyState}>
                <CardContent className="text-center p-6 md:p-8">
                  <MascotImage
                    variant={selectedDirectoryId ? 'curious' : 'neutral'}
                    alt={selectedDirectoryId ? 'Forge looking curious' : 'Forge waiting for documents'}
                    className="mx-auto mb-4 h-28 w-28"
                  />
                  <h3 className="text-lg font-semibold mb-2">
                    {selectedDirectoryId ? 'Empty folder' : 'No documents yet'}
                  </h3>
                  <p className="text-muted-foreground mb-4 text-sm md:text-base">
                    {selectedDirectoryId 
                      ? 'Add documents or create subfolders to organize your content'
                      : 'Create your first document from a URL or by uploading a markdown file'
                    }
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      onClick={() => handleCreateDirectory(selectedDirectoryId)}
                      className="w-full sm:w-auto gap-2"
                    >
                      <FolderPlus size={16} />
                      New Folder
                    </Button>
                    {selectedDirectoryId && (
                      <Button 
                        onClick={handlers.handleCreateDocument}
                        className="w-full sm:w-auto"
                      >
                        <Plus size={16} />
                        Create Document
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Content Section - Folders and Documents */}
            {(subdirectories.length > 0 || documents.length > 0 || isLoadingDocuments) && (
              <div className="space-y-6">
                {/* Folders Section */}
                {subdirectories.length > 0 && (
                  <div className="px-4 md:px-6">
                    <h2 className="text-lg font-semibold mb-3">Folders</h2>
                    <div className={documentsPageStyles.documentsGrid}>
                      {subdirectories.map((dir: Directory) => (
                        <FolderCard
                          key={dir.id}
                          directory={dir}
                          onClick={() => handlers.handleSelectDirectory(dir.id)}
                          onEdit={() => setEditDialog({ open: true, directory: dir })}
                          onDelete={() => setDeleteDialog({ open: true, directory: dir })}
                          onMove={() => setMoveDialog({ directory: dir })}
                          onManageRules={() => navigate(`/directories/${dir.id}/rules`)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents Section */}
                {isLoadingDocuments && !isRoot ? (
                  <div className="flex justify-center items-center px-4 md:px-6 py-8">
                    <Spinner size="md" />
                  </div>
                ) : documents.length > 0 ? (
                  <div className="px-4 md:px-6">
                    <h2 className="text-lg font-semibold mb-3">Documents</h2>
                    <div className={documentsPageStyles.documentsGrid}>
                      {documents.map((document: DocumentEnhanced) => (
                        <Card
                          key={document.id}
                          className={documentsPageStyles.documentCard + ' border-l-[4px]'}
                          style={{ borderLeftColor: document.color ?? getDocumentFallbackColor(document.id) }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base md:text-lg truncate">{document.title}</CardTitle>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-2">
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
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs">
                                  {document.sourceType === 'url' ? '🌐 URL' : '📁 Upload'}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                                {document.description || `Document with ${document.wordCount} words`}
                              </p>
                              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handlers.handleViewDocument(document.id)}
                                  aria-label="View document"
                                >
                                  <Eye size={16} />
                                </Button>
                                <ActionsDropdown
                                  items={[
                                    {
                                      id: 'create-quiz',
                                      label: 'Create Quiz',
                                      icon: <Brain size={14} />,
                                      onClick: () => handlers.handleCreateQuizFromDocument(document.id, document.directoryId),
                                    },
                                    {
                                      id: 'generate-flashcards',
                                      label: 'Generate Flashcards',
                                      icon: <Layers size={14} />,
                                      onClick: () => handlers.handleGenerateFlashcardsFromDocument(document.id, document.directoryId),
                                    },
                                    {
                                      id: 'generate-slide-deck',
                                      label: 'Generate Slide Deck',
                                      icon: <Presentation size={14} />,
                                      onClick: () => handlers.handleGenerateSlideDeckFromDocument(document.id, document.directoryId),
                                    },
                                  ]}
                                  className="flex-1 w-full sm:w-auto"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handlers.handleDeleteDocument(document.id)}
                                  className="text-destructive hover:text-destructive"
                                  aria-label="Delete document"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : null}
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

      <MoveDirectoryDialog
        isOpen={moveDialog.directory !== null}
        onClose={() => setMoveDialog({ directory: null })}
        directory={moveDialog.directory}
        onSuccess={() => {
          // Refetch is handled automatically by RTK Query
        }}
      />
    </Page>
  );
};