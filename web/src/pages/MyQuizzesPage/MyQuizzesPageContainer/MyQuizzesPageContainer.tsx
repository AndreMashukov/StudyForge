import React from 'react';
import { useMyQuizzesPageContext } from '../context/hooks/useMyQuizzesPageContext';
import { Page } from '../../../components/Page';
import { Button } from '../../../components/ui/Button';
import { DocumentGroup } from '../components/DocumentGroup';
import { RefreshCw, Brain, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MyQuizzesPageContainer: React.FC = () => {
  const { groupedQuizzes, isLoading, error, handlers } = useMyQuizzesPageContext();
  const navigate = useNavigate();

  // Get document groups sorted by most recent quiz
  const documentGroups = Object.entries(groupedQuizzes).sort(([, quizzesA], [, quizzesB]) => {
    const mostRecentA = Math.max(...quizzesA.map(q => new Date(q.createdAt).getTime()));
    const mostRecentB = Math.max(...quizzesB.map(q => new Date(q.createdAt).getTime()));
    return mostRecentB - mostRecentA;
  });

  const totalQuizzes = Object.values(groupedQuizzes).flat().length;

  if (isLoading) {
    return (
      <Page showSidebar={true}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your quizzes...</p>
          </div>
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page showSidebar={true}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handlers.handleRefresh} variant="outline">
              <RefreshCw size={16} className="mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  if (totalQuizzes === 0) {
    return (
      <Page showSidebar={true}>
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Quizzes</h1>
              <p className="text-muted-foreground">
                All your quizzes organized by source document
              </p>
            </div>
          </div>

          <div className="text-center py-12">
            <Brain size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Quizzes Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first quiz from a document to get started!
            </p>
            <Button onClick={() => navigate('/documents')}>
              <Plus size={16} className="mr-2" />
              Go to Documents
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page showSidebar={true}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Quizzes</h1>
            <p className="text-muted-foreground">
              {totalQuizzes} quiz{totalQuizzes !== 1 ? 'es' : ''} from {documentGroups.length} document{documentGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handlers.handleRefresh}
              variant="outline"
              size="sm"
            >
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => navigate('/documents')}
              size="sm"
            >
              <Plus size={16} className="mr-2" />
              Create New
            </Button>
          </div>
        </div>

        <div>
          {documentGroups.map(([documentTitle, quizzes]) => (
            <DocumentGroup
              key={documentTitle}
              documentTitle={documentTitle}
              quizzes={quizzes}
              onQuizClick={handlers.handleQuizClick}
              onDeleteQuiz={handlers.handleDeleteQuiz}
            />
          ))}
        </div>
      </div>
    </Page>
  );
};