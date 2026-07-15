import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Page } from '../../../components/Page';
import { ActionsDropdown } from '../../../components/ui/ActionsDropdown';
import { MarkdownRenderer, TocItem } from '../../../components/MarkdownRenderer';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { BreadcrumbNav } from '../../../components/BreadcrumbNav';
import {
  Brain,
  ArrowLeft,
  Download,
  FileDown,
  List,
  X,
  Calendar,
  Layers,
  Presentation,
  Network,
  ListOrdered,
  Box,
  Sparkles,
} from 'lucide-react';
import { useDocumentViewerPageContext } from '../context';
import { Spinner } from '../../../components/ui/Spinner';
import {
  selectTocItems,
  selectShowToc,
  selectIsExporting,
  selectQuestionAnswer,
  selectQuestionError,
  clearQuestionAnswer,
  selectIsEditPanelOpen,
  selectEditAiState,
  selectEditPreviewContent,
  selectEditError,
  selectIsApplyingRevision,
  selectHasUnsavedEditPreview,
  setEditPanelOpen,
  resetEditPanelState,
  resetEditPreview,
} from '../../../store/slices/documentViewerPageSlice';
import { setSelectedDirectory } from '../../../store/slices/directorySlice';
import { formatDateWithOptions } from '../../../utils/dateUtils';
import { DocumentQuestionForm } from './DocumentQuestionForm';
import { MarkdownAIAssistantPanel } from '../../../components/MarkdownAIAssistantPanel';
import { AI_REVISION_INSTRUCTION_MAX } from '@shared-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/Dialog';
import { cn } from '../../../lib/utils';

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
  const navigate = useNavigate();
  const dispatch = useDispatch();
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
  const questionAnswer = useSelector(selectQuestionAnswer);
  const questionError = useSelector(selectQuestionError);
  const isEditPanelOpen = useSelector(selectIsEditPanelOpen);
  const editAiState = useSelector(selectEditAiState);
  const editPreviewContent = useSelector(selectEditPreviewContent);
  const editError = useSelector(selectEditError);
  const isApplyingRevision = useSelector(selectIsApplyingRevision);
  const hasUnsavedEditPreview = useSelector(selectHasUnsavedEditPreview);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    dispatch(clearQuestionAnswer());
    dispatch(resetEditPanelState());
  }, [documentId, dispatch]);

  const canEditWithAI = Boolean(
    contentApi.data?.content?.trim() &&
      !contentApi.isLoading &&
      !documentApi.isLoading &&
      documentApi.data?.generationStatus !== 'pending' &&
      documentApi.data?.generationStatus !== 'failed'
  );

  const handleToggleEditPanel = () => {
    if (isEditPanelOpen) {
      if (hasUnsavedEditPreview) {
        setShowDiscardConfirm(true);
        return;
      }
      dispatch(setEditPanelOpen(false));
      dispatch(resetEditPreview());
      return;
    }
    dispatch(setEditPanelOpen(true));
  };

  const handleConfirmDiscardAndClose = () => {
    setShowDiscardConfirm(false);
    dispatch(resetEditPanelState());
  };

  const editPanel = (
    <MarkdownAIAssistantPanel
      title="Edit with AI"
      idleDescription="Describe how you want to change this document."
      instructionPlaceholder='e.g., "Add a summary section at the top" or "Convert the bullet lists into tables"'
      generateLabel="Revise with AI"
      generatingLabel="Revising document with AI..."
      applyLabel={isApplyingRevision ? 'Saving...' : 'Apply'}
      instructionMaxLength={AI_REVISION_INSTRUCTION_MAX}
      aiState={editAiState}
      aiError={editError}
      previewContent={editPreviewContent}
      onGenerate={handlers.handleReviseWithAI}
      onApply={handlers.handleApplyRevision}
      onDiscard={handlers.handleDiscardRevision}
      isApplyDisabled={isApplyingRevision}
      confirmBeforeApply
      applyConfirmTitle="Replace document content?"
      applyConfirmMessage="This will replace the entire document content. This action cannot be undone."
    />
  );

  const handleBreadcrumbNavigate = (directoryId: string | null) => {
    dispatch(setSelectedDirectory(directoryId));
    if (directoryId) {
      navigate(`/directory/${directoryId}`);
      return;
    }
    navigate('/documents');
  };

  const handleCreateFlashcards = () => {
    if (!documentId) return;
    const directoryId = documentApi.data?.directoryId;
    const params = new URLSearchParams({ documentId });
    if (directoryId) {
      params.set('directoryId', directoryId);
    }
    navigate(`/flashcards/create?${params.toString()}`);
  };

  const handleCreateSlideDeck = () => {
    if (!documentId) return;
    const directoryId = documentApi.data?.directoryId;
    const params = new URLSearchParams({ documentId });
    if (directoryId) {
      params.set('directoryId', directoryId);
    }
    navigate(`/slides/create?${params.toString()}`);
  };

  const handleCreateDiagramQuiz = () => {
    if (!documentId) return;
    const directoryId = documentApi.data?.directoryId;
    const params = new URLSearchParams({ documentId });
    if (directoryId) {
      params.set('directoryId', directoryId);
    }
    navigate(`/diagram-quiz/create?${params.toString()}`);
  };

  const handleCreateSequenceQuiz = () => {
    if (!documentId) return;
    const directoryId = documentApi.data?.directoryId;
    const params = new URLSearchParams({ documentId });
    if (directoryId) {
      params.set('directoryId', directoryId);
    }
    navigate(`/sequence-quiz/create?${params.toString()}`);
  };

  const handleCreateSubjectWorld = () => {
    if (!documentId) return;
    const directoryId = documentApi.data?.directoryId;
    const params = new URLSearchParams({ documentId });
    if (directoryId) {
      params.set('directoryId', directoryId);
    }
    navigate(`/subject-world/create?${params.toString()}`);
  };

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
          <Spinner size="md" />
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
      <div
        className={cn(
          'mx-auto space-y-6',
          isEditPanelOpen ? 'max-w-7xl px-4' : 'max-w-4xl'
        )}
      >
        {/* Header */}
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b">
          <div className="flex items-center gap-3 px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <ArrowLeft size={16} />
              Go Back
            </Button>
            <BreadcrumbNav
              directoryId={documentApi.data.directoryId || null}
              onNavigate={handleBreadcrumbNavigate}
              lastItemClickable
              className="min-w-0 flex-1"
            />
          </div>
        </div>

        {/* Document Info */}
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="space-y-2 min-w-0 flex-1">
                <CardTitle className="text-2xl font-bold leading-tight">
                  {documentApi.data.title}
                </CardTitle>
                {documentApi.data.description && (
                  <p className="text-muted-foreground text-base leading-relaxed">
                    {documentApi.data.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
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

                {/* Export dropdown */}
                {contentApi.data?.content && (
                  <ActionsDropdown
                    align="end"
                    trigger={
                      <Button variant="outline" size="sm">
                        <FileDown size={16} className="mr-2" />
                        Export
                      </Button>
                    }
                    items={[
                      {
                        id: 'download-md',
                        label: 'Download MD',
                        icon: <FileDown size={14} />,
                        onClick: handlers.handleDownloadMd,
                      },
                      {
                        id: 'export-pdf',
                        label: isExporting ? 'Exporting...' : 'Export PDF',
                        icon: <Download size={14} />,
                        onClick: handlers.handleExportPDF,
                        disabled: isExporting,
                      },
                    ]}
                  />
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
                    {
                      id: 'generate-flashcards',
                      label: 'Generate Flashcards',
                      icon: <Layers size={16} />,
                      onClick: handleCreateFlashcards,
                    },
                    {
                      id: 'generate-slide-deck',
                      label: 'Generate Slide Deck',
                      icon: <Presentation size={16} />,
                      onClick: handleCreateSlideDeck,
                    },
                    {
                      id: 'create-diagram-quiz',
                      label: 'Create Diagram Quiz',
                      icon: <Network size={16} />,
                      onClick: handleCreateDiagramQuiz,
                    },
                    {
                      id: 'create-sequence-quiz',
                      label: 'Create Sequence Quiz',
                      icon: <ListOrdered size={16} />,
                      onClick: handleCreateSequenceQuiz,
                    },
                    {
                      id: 'create-subject-world',
                      label: 'Explore as Game',
                      icon: <Box size={16} />,
                      onClick: handleCreateSubjectWorld,
                    },
                  ]}
                />
              </div>
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
        {isEditPanelOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-background flex flex-col p-4 pt-24 overflow-y-auto">
            {editPanel}
          </div>
        )}

        <div className={cn('flex gap-6 relative', isEditPanelOpen && 'md:flex-row md:items-start')}>
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
          <div
            className={cn(
              'flex-1 min-w-0',
              isEditPanelOpen && 'hidden md:block md:w-[60%] md:flex-none'
            )}
          >
            <Card ref={contentRef}>
              <CardContent className="p-6">
                {contentApi.isLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <Spinner size="md" />
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

          {isEditPanelOpen && (
            <div className="hidden md:block md:w-[40%] min-h-[32rem] sticky top-24 self-start">
              {editPanel}
            </div>
          )}
        </div>

        {!isEditPanelOpen && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Ask about this document</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentQuestionForm
                onSubmit={handlers.handleAskDocumentQuestion}
                answer={questionAnswer}
                error={questionError}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {canEditWithAI && (
        <Button
          type="button"
          onClick={handleToggleEditPanel}
          className="fixed bottom-6 right-6 z-50 shadow-lg gap-2"
          aria-label={isEditPanelOpen ? 'Close AI editor' : 'Edit with AI'}
        >
          {isEditPanelOpen ? <X size={16} /> : <Sparkles size={16} />}
          {isEditPanelOpen ? 'Close editor' : 'Edit with AI'}
        </Button>
      )}

      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have an AI revision preview that has not been applied. Discard it and close the
              editor?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleConfirmDiscardAndClose}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
};
