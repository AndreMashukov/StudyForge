import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../hooks/redux';
import {
  useGetDirectoryContentsWithArtifactSummariesQuery,
  useGetDirectoryAncestorsQuery,
} from '../../store/api/Directory/DirectoryApi';
import { selectIsGeneratingArtifact } from '../../store/slices/artifactGenerationSlice';
import { Page } from '../../components/Page';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu';
import {
  ArrowLeft,
  Folder,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  Shield,
} from 'lucide-react';
import { DocumentEnhanced, Directory, ArtifactSummary } from '@shared-types';
import { ICON_MAP } from '../DocumentsPage/DocumentsPageContainer/folderConstants';
import { CreateDirectoryDialog } from '../DocumentsPage/DocumentsPageContainer/CreateDirectoryDialog';
import { EditDirectoryDialog } from '../DocumentsPage/DocumentsPageContainer/EditDirectoryDialog';
import { DeleteDirectoryDialog } from '../DocumentsPage/DocumentsPageContainer/DeleteDirectoryDialog';
import { DeleteDocumentDialog } from './DeleteDocumentDialog';
import { MoveDocumentDialog } from './MoveDocumentDialog';
import { DeleteArtifactDialog, ArtifactToDelete } from './DeleteArtifactDialog';
import { DirectoryIconSidebar, PanelType } from './DirectoryIconSidebar';
import { SourcesPanel } from './SourcesPanel';
import { QuizzesPanel } from './QuizzesPanel';
import { FlashcardsPanel } from './FlashcardsPanel';
import { SlidesPanel } from './SlidesPanel';
import { DiagramQuizzesPanel } from './DiagramQuizzesPanel';
import { Spinner } from '../../components/ui/Spinner';
import { SequenceQuizzesPanel } from './SequenceQuizzesPanel';
import { RulesPanel } from './RulesPanel';

/** Valid tab values that can be passed via URL search param. */
const VALID_TABS = new Set<string>(['sources', 'quizzes', 'cards', 'slides', 'diagramQuizzes', 'sequenceQuizzes', 'rules']);

/** Max artifacts loaded per type (server caps at 100). */
const ARTIFACT_PAGE_LIMIT = 100;

export const DirectoryDetailPageContainer = () => {
  const { directoryId } = useParams<{ directoryId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const getTabFromParams = (): PanelType => {
    const tab = searchParams.get('tab');
    return tab && VALID_TABS.has(tab) ? (tab as PanelType) : 'sources';
  };

  const [activePanel, setActivePanel] = useState<PanelType>(getTabFromParams);

  // Update panel when URL params or directory changes
  useEffect(() => {
    setActivePanel(getTabFromParams());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryId, searchParams]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{ directory: Directory | null }>({ directory: null });
  const [deleteDialog, setDeleteDialog] = useState<{ directory: Directory | null }>({ directory: null });
  const [deleteDocDialog, setDeleteDocDialog] = useState<{ document: DocumentEnhanced | null }>({ document: null });
  const [moveDocDialog, setMoveDocDialog] = useState<{ document: DocumentEnhanced | null }>({ document: null });
  const [deleteArtifactDialog, setDeleteArtifactDialog] = useState<{ artifact: ArtifactToDelete | null }>({ artifact: null });

  const isGeneratingQuizzes = useAppSelector((state) => selectIsGeneratingArtifact(state, directoryId ?? '', 'quizzes'));
  const isGeneratingCards = useAppSelector((state) => selectIsGeneratingArtifact(state, directoryId ?? '', 'cards'));
  const isGeneratingSlides = useAppSelector((state) => selectIsGeneratingArtifact(state, directoryId ?? '', 'slides'));
  const isGeneratingDiagramQuizzes = useAppSelector((state) => selectIsGeneratingArtifact(state, directoryId ?? '', 'diagramQuizzes'));
  const isGeneratingSequenceQuizzes = useAppSelector((state) => selectIsGeneratingArtifact(state, directoryId ?? '', 'sequenceQuizzes'));
  const isGeneratingSources = useAppSelector((state) => selectIsGeneratingArtifact(state, directoryId ?? '', 'sources'));

  const {
    data: contents,
    isLoading,
    error,
  } = useGetDirectoryContentsWithArtifactSummariesQuery(
    { directoryId: directoryId ?? null, artifactLimit: ARTIFACT_PAGE_LIMIT },
    { skip: !directoryId }
  );

  const { data: ancestorsData } = useGetDirectoryAncestorsQuery(directoryId ?? '', {
    skip: !directoryId,
  });

  if (!directoryId) {
    return (
      <Page showSidebar>
        <div className="p-6 text-muted-foreground">Invalid directory.</div>
      </Page>
    );
  }

  if (isLoading) {
    return (
      <Page showSidebar>
        <div className="flex justify-center items-center p-16">
          <Spinner size="md" />
        </div>
      </Page>
    );
  }

  if (error || !contents?.directory) {
    return (
      <Page showSidebar>
        <Card className="m-4 border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">Could not load this directory.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/documents')}>
              Back to directories
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  const dir = contents.directory;
  const subdirectories = contents.subdirectories || [];
  const documents = contents.documents || [];
  const artifactSummaries = contents.artifactSummaries || [];
  const quizzes = artifactSummaries.filter((a): a is ArtifactSummary & { type: 'quiz' } => a.type === 'quiz');
  const flashcardSets = artifactSummaries.filter((a): a is ArtifactSummary & { type: 'flashcard' } => a.type === 'flashcard');
  const slideDecks = artifactSummaries.filter((a): a is ArtifactSummary & { type: 'slideDeck' } => a.type === 'slideDeck');
  const diagramQuizzes = artifactSummaries.filter((a): a is ArtifactSummary & { type: 'diagramQuiz' } => a.type === 'diagramQuiz');
  const sequenceQuizzes = artifactSummaries.filter((a): a is ArtifactSummary & { type: 'sequenceQuiz' } => a.type === 'sequenceQuiz');
  const resolvedRules = contents.resolvedRules;
  const ancestors = ancestorsData?.ancestors || [];

  // Detect truncation: server caps at ARTIFACT_PAGE_LIMIT per type
  const quizzesTruncated = quizzes.length >= ARTIFACT_PAGE_LIMIT;
  const flashcardsTruncated = flashcardSets.length >= ARTIFACT_PAGE_LIMIT;
  const slidesTruncated = slideDecks.length >= ARTIFACT_PAGE_LIMIT;
  const diagramQuizzesTruncated = diagramQuizzes.length >= ARTIFACT_PAGE_LIMIT;
  const sequenceQuizzesTruncated = sequenceQuizzes.length >= ARTIFACT_PAGE_LIMIT;

  return (
    <Page showSidebar>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header: Back button + Breadcrumb + Directory title + Action buttons */}
        <div className="flex flex-col gap-4">
          {/* Back button */}
          <Button
            variant="ghost"
            className="self-start gap-2 text-muted-foreground"
            onClick={() =>
              navigate(
                ancestors.length > 0
                  ? `/directory/${ancestors[ancestors.length - 1].id}`
                  : '/documents'
              )
            }
          >
            <ArrowLeft size={18} />
            Back
          </Button>

          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground flex flex-wrap gap-1 items-center">
            <Link to="/documents" className="hover:text-foreground">
              Directories
            </Link>
            {ancestors.map((a: Directory) => (
              <span key={a.id} className="flex items-center gap-1">
                <span className="text-border">/</span>
                <Link to={`/directory/${a.id}`} className="hover:text-foreground">
                  {a.name}
                </Link>
              </span>
            ))}
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">{dir.name}</span>
          </nav>

          {/* Directory title + actions row */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                {(() => {
                  const TitleIcon = ICON_MAP[dir.icon || 'Folder'] || Folder;
                  return <TitleIcon size={28} color={dir.color || undefined} className={!dir.color ? 'text-primary' : ''} />;
                })()}
                {dir.name}
              </h1>
              {dir.description && (
                <p className="text-muted-foreground mt-2 max-w-2xl">{dir.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
                <FolderPlus size={16} />
                New subfolder
              </Button>
              <Button size="sm" asChild>
                <Link to={`/documents/create?directoryId=${directoryId}`}>Add source</Link>
              </Button>
            </div>
          </div>

          {/* Subfolder pills */}
          {subdirectories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {subdirectories.map((sub: Directory) => {
                const IconComponent = ICON_MAP[sub.icon || 'Folder'] || Folder;
                return (
                  <div
                    key={sub.id}
                    className="group/pill inline-flex items-center gap-0.5 rounded-full border border-border text-sm hover:bg-muted/50 transition-colors"
                  >
                    <Link
                      to={`/directory/${sub.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5"
                    >
                      <IconComponent
                        size={14}
                        color={sub.color || undefined}
                        className={sub.color ? 'shrink-0' : 'text-primary shrink-0'}
                      />
                      {sub.name}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Actions for ${sub.name}`}
                        >
                          <MoreVertical size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditDialog({ directory: sub })}
                        >
                          <Pencil size={14} className="mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/directories/${sub.id}/rules`)}
                        >
                          <Shield size={14} className="mr-2" />
                          Manage rules
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteDialog({ directory: sub })}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete folder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Main layout: Icon Sidebar + Content Panel */}
        <div className="flex gap-4">
          <DirectoryIconSidebar activePanel={activePanel} onPanelChange={setActivePanel} />
          <div className="flex-1 min-w-0">
            {activePanel === 'sources' && (
              <SourcesPanel
                documents={documents}
                directoryId={directoryId}
                onDeleteDocument={(doc) => setDeleteDocDialog({ document: doc })}
                onMoveDocument={(doc) => setMoveDocDialog({ document: doc })}
                isGenerating={isGeneratingSources}
              />
            )}
            {activePanel === 'quizzes' && (
              <QuizzesPanel
                quizzes={quizzes}
                directoryId={directoryId}
                mayBeTruncated={quizzesTruncated}
                isGenerating={isGeneratingQuizzes}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
              />
            )}
            {activePanel === 'cards' && (
              <FlashcardsPanel
                flashcardSets={flashcardSets}
                directoryId={directoryId}
                mayBeTruncated={flashcardsTruncated}
                isGenerating={isGeneratingCards}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
              />
            )}
            {activePanel === 'slides' && (
              <SlidesPanel
                slideDecks={slideDecks}
                directoryId={directoryId}
                mayBeTruncated={slidesTruncated}
                isGenerating={isGeneratingSlides}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
              />
            )}
            {activePanel === 'diagramQuizzes' && (
              <DiagramQuizzesPanel
                diagramQuizzes={diagramQuizzes}
                directoryId={directoryId}
                mayBeTruncated={diagramQuizzesTruncated}
                isGenerating={isGeneratingDiagramQuizzes}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
              />
            )}
            {activePanel === 'sequenceQuizzes' && (
              <SequenceQuizzesPanel
                sequenceQuizzes={sequenceQuizzes}
                directoryId={directoryId}
                mayBeTruncated={sequenceQuizzesTruncated}
                isGenerating={isGeneratingSequenceQuizzes}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
              />
            )}
            {activePanel === 'rules' && (
              <RulesPanel
                rules={resolvedRules?.inheritanceMap?.[directoryId] ?? []}
                directoryId={directoryId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateDirectoryDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        parentId={directoryId}
        onSuccess={() => setCreateDialogOpen(false)}
      />

      <EditDirectoryDialog
        isOpen={!!editDialog.directory}
        onClose={() => setEditDialog({ directory: null })}
        directory={editDialog.directory}
        onSuccess={() => setEditDialog({ directory: null })}
      />

      <DeleteDirectoryDialog
        isOpen={!!deleteDialog.directory}
        onClose={() => setDeleteDialog({ directory: null })}
        directory={deleteDialog.directory}
        onSuccess={() => setDeleteDialog({ directory: null })}
      />

      <DeleteDocumentDialog
        isOpen={!!deleteDocDialog.document}
        onClose={() => setDeleteDocDialog({ document: null })}
        document={deleteDocDialog.document}
        onSuccess={() => setDeleteDocDialog({ document: null })}
      />

      <MoveDocumentDialog
        isOpen={!!moveDocDialog.document}
        onClose={() => setMoveDocDialog({ document: null })}
        document={moveDocDialog.document}
        currentDirectoryId={directoryId}
        onSuccess={() => setMoveDocDialog({ document: null })}
      />

      <DeleteArtifactDialog
        isOpen={!!deleteArtifactDialog.artifact}
        onClose={() => setDeleteArtifactDialog({ artifact: null })}
        artifact={deleteArtifactDialog.artifact}
      />
    </Page>
  );
};
