import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useGetDirectoryContentsWithArtifactsQuery,
  useGetDirectoryAncestorsQuery,
} from '../../store/api/Directory/DirectoryApi';
import { Page } from '../../components/Page';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu';
import {
  ArrowLeft,
  Brain,
  Layers,
  Presentation,
  FileText,
  FolderOpen,
  FolderPlus,
  ChevronDown,
  Sparkles,
  Settings,
  Trash2,
} from 'lucide-react';
import { DocumentEnhanced, Directory, Quiz, FlashcardSet, SlideDeck, Rule } from '@shared-types';
import { formatDate } from '../../utils/dateUtils';
import { cn } from '../../lib/utils';
import { CreateDirectoryDialog } from '../DocumentsPage/DocumentsPageContainer/CreateDirectoryDialog';
import { DeleteDirectoryDialog } from '../DocumentsPage/DocumentsPageContainer/DeleteDirectoryDialog';

/** Max artifacts loaded per type (server caps at 100). Tab totals use directory denormalized counts. */
const ARTIFACT_PAGE_LIMIT = 100;

export const DirectoryDetailPageContainer = () => {
  const { directoryId } = useParams<{ directoryId: string }>();
  const navigate = useNavigate();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [artifactTab, setArtifactTab] = useState('quizzes');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ directory: Directory | null }>({ directory: null });

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

  const quizTotal = dir.quizCount ?? quizzes.length;
  const fcTotal = dir.flashcardSetCount ?? flashcardSets.length;
  const sdTotal = dir.slideDeckCount ?? slideDecks.length;

  const quizListTruncated =
    quizzes.length >= ARTIFACT_PAGE_LIMIT && quizTotal > quizzes.length;
  const fcListTruncated =
    flashcardSets.length >= ARTIFACT_PAGE_LIMIT && fcTotal > flashcardSets.length;
  const sdListTruncated =
    slideDecks.length >= ARTIFACT_PAGE_LIMIT && sdTotal > slideDecks.length;

  const ancestors = ancestorsData?.ancestors || [];

  return (
    <Page showSidebar>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            className="self-start gap-2 text-muted-foreground"
            onClick={() => navigate('/documents')}
          >
            <ArrowLeft size={18} />
            Back to My Directories
          </Button>

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
              <Button variant="outline" size="sm" asChild>
                <Link to={`/directories/${directoryId}/rules`}>
                  <Settings size={16} />
                  Rules
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    Generate
                    <ChevronDown size={16} className="ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => navigate(`/quiz/create?directoryId=${directoryId}`)}
                  >
                    <Brain size={16} className="mr-2" />
                    Quiz
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      navigate(`/flashcards/create?directoryId=${directoryId}`)
                    }
                  >
                    <Layers size={16} className="mr-2" />
                    Flashcards
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate(`/slides/create?directoryId=${directoryId}`)}
                  >
                    <Presentation size={16} className="mr-2" />
                    Slide deck
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
                <FolderPlus size={16} />
                New subfolder
              </Button>
              <Button size="sm" asChild>
                <Link to={`/documents/create?directoryId=${directoryId}`}>Add source</Link>
              </Button>
            </div>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3">Sources</h2>
          {documents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No documents yet. Add a URL, upload markdown, or generate from a prompt.
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {documents.map((doc: DocumentEnhanced) => (
                <Card key={doc.id} className="hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base truncate flex items-center gap-2">
                      <FileText size={18} className="shrink-0 text-muted-foreground" />
                      {doc.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {doc.wordCount} words · {formatDate(doc.createdAt)}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/document/${doc.id}`}>Open</Link>
                      </Button>
                      <Button variant="secondary" size="sm" asChild>
                        <Link to={`/quiz/create?directoryId=${directoryId}&documentId=${doc.id}`}>
                          Quiz
                        </Link>
                      </Button>
                      <Button variant="secondary" size="sm" asChild>
                        <Link
                          to={`/flashcards/create?directoryId=${directoryId}&documentId=${doc.id}`}
                        >
                          Cards
                        </Link>
                      </Button>
                      <Button variant="secondary" size="sm" asChild>
                        <Link to={`/slides/create?directoryId=${directoryId}&documentId=${doc.id}`}>
                          Slides
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Artifacts</h2>
          <Tabs value={artifactTab} onValueChange={setArtifactTab}>
            <TabsList>
              <TabsTrigger value="quizzes">Quizzes ({quizTotal})</TabsTrigger>
              <TabsTrigger value="flashcards">Flashcards ({fcTotal})</TabsTrigger>
              <TabsTrigger value="slides">Slide decks ({sdTotal})</TabsTrigger>
            </TabsList>
            {(quizListTruncated || fcListTruncated || sdListTruncated) && (
              <p className="text-xs text-muted-foreground mt-2">
                Lists show the newest {ARTIFACT_PAGE_LIMIT} per type when there are more — totals above are
                for the whole folder.
              </p>
            )}
            <TabsContent value="quizzes" className="mt-4 space-y-2">
              {quizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quizzes in this directory yet.</p>
              ) : (
                quizzes.map((q: Quiz) => (
                  <Link
                    key={q.id}
                    to={`/quiz/${q.id}?directoryId=${encodeURIComponent(directoryId ?? '')}`}
                    className={cn(
                      'block rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors'
                    )}
                  >
                    <div className="font-medium">{q.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</div>
                  </Link>
                ))
              )}
            </TabsContent>
            <TabsContent value="flashcards" className="mt-4 space-y-2">
              {flashcardSets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No flashcard sets yet.</p>
              ) : (
                flashcardSets.map((f: FlashcardSet) => (
                  <Link
                    key={f.id}
                    to={`/flashcards/${f.id}?directoryId=${encodeURIComponent(directoryId ?? '')}`}
                    className="block rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium">{f.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(f.createdAt as unknown as Date)}
                    </div>
                  </Link>
                ))
              )}
            </TabsContent>
            <TabsContent value="slides" className="mt-4 space-y-2">
              {slideDecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slide decks yet.</p>
              ) : (
                slideDecks.map((s: SlideDeck) => (
                  <Link
                    key={s.id}
                    to={`/slides/${s.id}?directoryId=${encodeURIComponent(directoryId ?? '')}`}
                    className="block rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(s.createdAt as unknown as Date)}
                    </div>
                  </Link>
                ))
              )}
            </TabsContent>
          </Tabs>
        </section>

        <section>
          <button
            type="button"
            onClick={() => setRulesOpen(!rulesOpen)}
            className="flex items-center gap-2 text-lg font-semibold w-full text-left"
          >
            <Sparkles size={20} className="text-primary" />
            Rules (cascading)
            <span className="text-sm font-normal text-muted-foreground">
              {rulesOpen ? '▼' : '▶'}
            </span>
          </button>
          {rulesOpen && (
            <div className="mt-3 space-y-3">
              {resolvedRules.rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No rules attached. Manage rules from the Rules button above.
                </p>
              ) : (
                resolvedRules.rules.map((rule: Rule) => (
                  <Card key={rule.id}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{rule.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground line-clamp-4">
                      {rule.content}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Subfolders</h2>
          {subdirectories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No subfolders yet.
                <Button variant="link" className="ml-1 p-0" onClick={() => setCreateDialogOpen(true)}>
                  Create one
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {subdirectories.map((sub: Directory) => (
                <div
                  key={sub.id}
                  className="rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors flex items-center gap-2 group"
                >
                  <Link
                    to={`/directory/${sub.id}`}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <FolderOpen size={20} className="text-primary shrink-0" />
                    <span className="font-medium truncate">{sub.name}</span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialog({ directory: sub });
                    }}
                    aria-label={`Delete ${sub.name}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

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
    </Page>
  );
};
