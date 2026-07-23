import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { setSelectedDirectory } from '../../store/slices/directorySlice';
import {
  buildChildDirectoryNavigationState,
  DIRECTORY_DOCUMENTS_BACK_TARGET,
  resolveDirectoryBackTarget,
  resolveParentBackState,
} from '../../utils/directoryNavigationState';
import {
  useGetDirectoryContentsWithArtifactSummariesQuery,
  useGetDirectoryAncestorsQuery,
} from '../../store/api/Directory/DirectoryApi';
import { useGetDirectoryRulesQuery } from '../../store/api/Rules/rulesApi';
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
  FolderInput,
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
import { MoveDirectoryDialog } from '../DocumentsPage/DocumentsPageContainer/MoveDirectoryDialog';
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
import { SubjectWorldsPanel } from './SubjectWorldsPanel';
import { RulesPanel } from './RulesPanel';
import { TooltipProvider } from '../../components/ui/Tooltip';
import { DirectoryChatPanel } from '../../components/DirectoryChatPanel';
import {
  buildDirectoryPath,
  extractDirectoryIdFromDirectoryPath,
  extractDirectoryIdFromRouteParam,
} from '../../utils/directoryUrl';

/** Valid tab values that can be passed via URL search param. */
const VALID_TABS = new Set<string>(['sources', 'quizzes', 'cards', 'slides', 'diagramQuizzes', 'sequenceQuizzes', 'subjectWorlds', 'chat', 'rules']);

/** Max artifacts loaded per type (server caps at 100). */
const ARTIFACT_PAGE_LIMIT = 100;

export const DirectoryDetailPageContainer = () => {
  const { directoryId: directoryRouteParam } = useParams<{ directoryId: string }>();
  const directoryId = useMemo(
    () => extractDirectoryIdFromRouteParam(directoryRouteParam),
    [directoryRouteParam],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
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
  const [moveDirectoryDialog, setMoveDirectoryDialog] = useState<{ directory: Directory | null }>({ directory: null });
  const [deleteDocDialog, setDeleteDocDialog] = useState<{ document: DocumentEnhanced | null }>({ document: null });
  const [moveDocDialog, setMoveDocDialog] = useState<{ document: DocumentEnhanced | null }>({ document: null });
  const [deleteArtifactDialog, setDeleteArtifactDialog] = useState<{ artifact: ArtifactToDelete | null }>({ artifact: null });

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

  const { data: directoryRulesData, isLoading: isLoadingDirectoryRules } =
    useGetDirectoryRulesQuery(
      { directoryId: directoryId ?? '', includeAncestors: true },
      { skip: !directoryId },
    );

  const titleDirectory = contents?.directory;

  useEffect(() => {
    if (!directoryId || !titleDirectory || titleDirectory.id !== directoryId) {
      return;
    }

    const canonicalPath = buildDirectoryPath(titleDirectory);
    if (location.pathname !== canonicalPath) {
      navigate(`${canonicalPath}${location.search}`, {
        replace: true,
        state: location.state,
      });
    }
  }, [directoryId, titleDirectory, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const directoryName = titleDirectory && titleDirectory.id === directoryId ? titleDirectory.name : undefined;
    document.title = directoryName ? `StudyForge - ${directoryName}` : 'StudyForge';

    return () => {
      document.title = 'StudyForge';
    };
  }, [titleDirectory, directoryId]);

  const parentDirectory =
    ancestorsData?.ancestors && ancestorsData.ancestors.length > 0
      ? ancestorsData.ancestors[ancestorsData.ancestors.length - 1]
      : null;

  const handleBack = useCallback(() => {
    const backTarget = resolveDirectoryBackTarget(location.state, parentDirectory);
    const parentBackState = resolveParentBackState(location.state);

    if (backTarget === DIRECTORY_DOCUMENTS_BACK_TARGET) {
      dispatch(setSelectedDirectory(null));
    } else if (backTarget.startsWith('/directory/')) {
      const backDirectoryId = extractDirectoryIdFromDirectoryPath(backTarget);
      if (backDirectoryId) {
        dispatch(setSelectedDirectory(backDirectoryId));
      }
    }

    navigate(backTarget, { replace: true, state: parentBackState });
  }, [dispatch, location.state, navigate, parentDirectory]);

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
  const subjectWorlds = artifactSummaries.filter((a): a is ArtifactSummary & { type: 'subjectWorld' } => a.type === 'subjectWorld');
  const directoryRules = directoryRulesData?.rules ?? [];
  const ruleNamesMap = new Map<string, string>(
    directoryRules.map((rule) => [rule.id, rule.name]),
  );
  const ancestors = ancestorsData?.ancestors || [];

  // Detect truncation: server caps at ARTIFACT_PAGE_LIMIT per type
  const quizzesTruncated = quizzes.length >= ARTIFACT_PAGE_LIMIT;
  const flashcardsTruncated = flashcardSets.length >= ARTIFACT_PAGE_LIMIT;
  const slidesTruncated = slideDecks.length >= ARTIFACT_PAGE_LIMIT;
  const diagramQuizzesTruncated = diagramQuizzes.length >= ARTIFACT_PAGE_LIMIT;
  const sequenceQuizzesTruncated = sequenceQuizzes.length >= ARTIFACT_PAGE_LIMIT;
  const subjectWorldsTruncated = subjectWorlds.length >= ARTIFACT_PAGE_LIMIT;

  return (
    <TooltipProvider>
    <Page showSidebar>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header: compact Back + Breadcrumb, title/actions, subfolder pills */}
        <div className="flex flex-col gap-2">
          {/* Back + breadcrumb on one row */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={handleBack}
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <span className="text-border" aria-hidden="true">
              |
            </span>
            <nav className="flex flex-wrap items-center gap-1">
              <Link to="/documents" className="hover:text-foreground">
                Directories
              </Link>
              {ancestors.map((a: Directory) => (
                <span key={a.id} className="flex items-center gap-1">
                  <span className="text-border">/</span>
                  <Link to={buildDirectoryPath(a)} className="hover:text-foreground">
                    {a.name}
                  </Link>
                </span>
              ))}
              <span className="text-border">/</span>
              <span className="text-foreground font-medium">{dir.name}</span>
            </nav>
          </div>

          {/* Directory title + actions row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                {(() => {
                  const TitleIcon = ICON_MAP[dir.icon || 'Folder'] || Folder;
                  return <TitleIcon size={28} color={dir.color || undefined} className={!dir.color ? 'text-primary' : ''} />;
                })()}
                {dir.name}
              </h1>
              {dir.description && (
                <p className="text-muted-foreground mt-1 text-sm max-w-2xl">{dir.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
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
                      to={buildDirectoryPath(sub)}
                      state={buildChildDirectoryNavigationState(dir, location.state)}
                      className="inline-flex items-center gap-1.5 px-3 py-1"
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
                          className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
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
                          onClick={() => setMoveDirectoryDialog({ directory: sub })}
                        >
                          <FolderInput size={14} className="mr-2" />
                          Move to...
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
                ruleNamesMap={ruleNamesMap}
              />
            )}
            {activePanel === 'quizzes' && (
              <QuizzesPanel
                quizzes={quizzes}
                directoryId={directoryId}
                mayBeTruncated={quizzesTruncated}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
                ruleNamesMap={ruleNamesMap}
              />
            )}
            {activePanel === 'cards' && (
              <FlashcardsPanel
                flashcardSets={flashcardSets}
                directoryId={directoryId}
                mayBeTruncated={flashcardsTruncated}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
                ruleNamesMap={ruleNamesMap}
              />
            )}
            {activePanel === 'slides' && (
              <SlidesPanel
                slideDecks={slideDecks}
                directoryId={directoryId}
                mayBeTruncated={slidesTruncated}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
                ruleNamesMap={ruleNamesMap}
              />
            )}
            {activePanel === 'diagramQuizzes' && (
              <DiagramQuizzesPanel
                diagramQuizzes={diagramQuizzes}
                directoryId={directoryId}
                mayBeTruncated={diagramQuizzesTruncated}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
                ruleNamesMap={ruleNamesMap}
              />
            )}
            {activePanel === 'sequenceQuizzes' && (
              <SequenceQuizzesPanel
                sequenceQuizzes={sequenceQuizzes}
                directoryId={directoryId}
                mayBeTruncated={sequenceQuizzesTruncated}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
                ruleNamesMap={ruleNamesMap}
              />
            )}
            {activePanel === 'subjectWorlds' && (
              <SubjectWorldsPanel
                subjectWorlds={subjectWorlds}
                directoryId={directoryId}
                mayBeTruncated={subjectWorldsTruncated}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
                ruleNamesMap={ruleNamesMap}
              />
            )}
            {activePanel === 'chat' && (
              <DirectoryChatPanel
                directoryId={directoryId}
                sourceCount={documents.length}
              />
            )}
            {activePanel === 'rules' && (
              <RulesPanel
                rules={directoryRules}
                directoryId={directoryId}
                isLoading={isLoadingDirectoryRules}
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

      <MoveDirectoryDialog
        isOpen={!!moveDirectoryDialog.directory}
        onClose={() => setMoveDirectoryDialog({ directory: null })}
        directory={moveDirectoryDialog.directory}
        onSuccess={() => setMoveDirectoryDialog({ directory: null })}
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
    </TooltipProvider>
  );
};
