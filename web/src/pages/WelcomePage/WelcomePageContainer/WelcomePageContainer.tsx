import React from 'react';
import { STARTER_COURSE_SUBJECT_SUGGESTIONS } from '@shared-types';
import { Page } from '../../../components/Page';
import { Spinner } from '../../../components/ui/Spinner';
import { useWelcomePageContext } from '../context/hooks/useWelcomePageContext';
import { SubjectPicker } from '../SubjectPicker';
import { StarterCourseBuild } from '../StarterCourseBuild';

export const WelcomePageContainer: React.FC = () => {
  const { data, handlers, view, coursePath, samplePath } = useWelcomePageContext();

  if (view.type === 'loading' || view.type === 'leave') {
    return (
      <Page showSidebar={true}>
        <div className="flex flex-1 items-center justify-center py-12">
          <Spinner size="lg" variant="muted" />
        </div>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      {view.type === 'build' ? (
        <StarterCourseBuild
          threadId={view.threadId}
          subject={data.onboarding?.subject ?? (handlers.subject || undefined)}
          coursePath={coursePath}
          samplePath={samplePath}
          onAgentMutated={handlers.handleAgentMutated}
        />
      ) : (
        <SubjectPicker
          subject={handlers.subject}
          suggestions={STARTER_COURSE_SUBJECT_SUGGESTIONS}
          isStarting={handlers.isStarting}
          isSkipping={handlers.isSkipping}
          error={handlers.error}
          onSubjectChange={handlers.handleSubjectChange}
          onStart={handlers.handleStartCourse}
          onSkip={handlers.handleSkip}
        />
      )}
    </Page>
  );
};
