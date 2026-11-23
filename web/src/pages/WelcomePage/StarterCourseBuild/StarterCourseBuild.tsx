import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderOpen, Sparkles } from 'lucide-react';
import { AgentPanel } from '../../../components/AgentPanel/AgentPanel';
import { Button } from '../../../components/ui/Button';
import type { IStarterCourseBuild } from './IStarterCourseBuild';

export const StarterCourseBuild: React.FC<IStarterCourseBuild> = ({
  threadId,
  subject,
  coursePath,
  samplePath,
  onAgentMutated,
}) => (
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4 lg:flex-row">
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
        className="h-[min(640px,70dvh)]"
      />
    </div>

    <aside className="flex w-full flex-col gap-3 lg:w-72" aria-label="Your course">
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
            Try the sample course: two short documents and a quiz.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to={samplePath}>Explore the sample course</Link>
          </Button>
        </div>
      ) : null}
    </aside>
  </div>
);
