import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, FolderOpen, RotateCcw, Sparkles } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { AgentPanel } from '../../../components/AgentPanel/AgentPanel';
import { Button } from '../../../components/ui/Button';
import type { IStarterCourseBuild } from './IStarterCourseBuild';

export const StarterCourseBuild: React.FC<IStarterCourseBuild> = ({
  threadId,
  subject,
  coursePath,
  samplePath,
  onAgentMutated,
  retryAvailable,
  isRetrying,
  error,
  onRetry,
}) => (
  <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 py-4 lg:flex-row">
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-4 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {subject ? `Building your ${subject} course` : 'Building your course'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Answer a few quick questions so the course fits you. Once it starts,
          the documents keep generating even if you leave this page.
        </p>
      </div>
      <AgentPanel
        variant="embedded"
        scope="workspace"
        pinnedThreadId={threadId}
        onMutated={onAgentMutated}
        className="h-[min(820px,78dvh)]"
      />
    </div>

    <aside className="flex w-full flex-col gap-3 lg:w-64 lg:shrink-0 xl:w-72" aria-label="Your course">
      {retryAvailable ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle size={16} className="text-destructive" aria-hidden="true" />
            Your documents could not be generated
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Something went wrong on our side. Try again, it is still free.
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Spinner size="xs" className="mr-2" />
            ) : (
              <RotateCcw size={16} className="mr-2" aria-hidden="true" />
            )}
            Try again
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles size={16} className="text-primary" aria-hidden="true" />
          Your course
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {coursePath
            ? 'Your folder is ready. Documents appear as they finish, then a quiz.'
            : 'Your folder appears here as soon as the agent creates it.'}
        </p>
        {coursePath ? (
          <Button asChild className="w-full">
            <Link to={coursePath}>
              Open my course
              <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button type="button" className="w-full" disabled>
            Open my course
          </Button>
        )}
      </div>

      {samplePath ? (
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <FolderOpen size={16} className="text-primary" aria-hidden="true" />
            While you wait
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Take the quick tour of StudyForge: three short guides and a quiz.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to={samplePath}>Take the tour</Link>
          </Button>
        </div>
      ) : null}
    </aside>
  </div>
);
