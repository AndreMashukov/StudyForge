import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useGetDirectoryContentsWithArtifactsQuery,
  useGetDirectoryAncestorsQuery,
} from '../../store/api/Directory/DirectoryApi';
import { Page } from '../../components/Page';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  ArrowLeft,
  Folder,
  FolderOpen,
  FolderPlus,
  Briefcase,
  Target,
  Zap,
  Rocket,
} from 'lucide-react';
import { DocumentEnhanced, Directory } from '@shared-types';
import { CreateDirectoryDialog } from '../DocumentsPage/DocumentsPageContainer/CreateDirectoryDialog';
import { DeleteDirectoryDialog } from '../DocumentsPage/DocumentsPageContainer/DeleteDirectoryDialog';
import { DeleteDocumentDialog } from './DeleteDocumentDialog';
import { DeleteArtifactDialog, ArtifactToDelete } from './DeleteArtifactDialog';
import { DirectoryIconSidebar, PanelType } from './DirectoryIconSidebar';
import { SourcesPanel } from './SourcesPanel';
import { QuizzesPanel } from './QuizzesPanel';
import { FlashcardsPanel } from './FlashcardsPanel';
import { SlidesPanel } from './SlidesPanel';
import { RulesPanel } from './RulesPanel';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {
  'Folder': Folder,
  'Folder Open': FolderOpen,
  'Briefcase': Briefcase,
  'Target': Target,
  'Zap': Zap,
  'Rocket': Rocket,
};

/** Max artifacts loaded per type (server caps at 100). */
const ARTIFACT_PAGE_LIMIT = 100;

export const DirectoryDetailPageContainer = () => {
  const { directoryId } = useParams<{ directoryId: string }>();
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState<PanelType>('sources');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ directory: Directory | null }>({ directory: null });
  const [deleteDocDialog, setDeleteDocDialog] = useState<{ document: DocumentEnhanced | null }>({ document: null });
  const [deleteArtifactDialog, setDeleteArtifactDialog] = useState<{ artifact: ArtifactToDelete | null }>({ artifact: null });

  const {
    data: contents,
    isLoading,
    error,
  } = useGetDirectoryContentsWithArtifactsQuery(
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
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
  const quizzes = contents.quizzes || [];
  const flashcardSets = contents.flashcardSets || [];
  const slideDecks = contents.slideDecks || [];
  const resolvedRules = contents.resolvedRules;
  const ancestors = ancestorsData?.ancestors || [];

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
                <FolderOpen className="text-primary" size={28} />
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
              {subdirectories.map((sub: Directory) => (
                <Link
                  key={sub.id}
                  to={`/directory/${sub.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-muted/50 transition-colors"
                >
                  {(() => {
                    const IconComponent = ICON_MAP[sub.icon || 'Folder'] || Folder;
                    return (
                      <IconComponent
                        size={14}
                        color={sub.color || undefined}
                        className={sub.color ? 'shrink-0' : 'text-primary shrink-0'}
                      />
                    );
                  })()}
                  {sub.name}
                </Link>
              ))}
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
              />
            )}
            {activePanel === 'quizzes' && (
              <QuizzesPanel
                quizzes={quizzes}
                directoryId={directoryId}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
              />
            )}
            {activePanel === 'cards' && (
              <FlashcardsPanel
                flashcardSets={flashcardSets}
                directoryId={directoryId}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
              />
            )}
            {activePanel === 'slides' && (
              <SlidesPanel
                slideDecks={slideDecks}
                directoryId={directoryId}
                onDeleteArtifact={(artifact) => setDeleteArtifactDialog({ artifact })}
              />
            )}
            {activePanel === 'rules' && (
              <RulesPanel
                rules={resolvedRules.rules}
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

      <DeleteArtifactDialog
        isOpen={!!deleteArtifactDialog.artifact}
        onClose={() => setDeleteArtifactDialog({ artifact: null })}
        artifact={deleteArtifactDialog.artifact}
      />
    </Page>
  );
};
