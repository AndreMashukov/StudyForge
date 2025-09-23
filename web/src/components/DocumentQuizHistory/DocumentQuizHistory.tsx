import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetDocumentQuizzesQuery } from '../../store/api/Quiz/QuizApi';
import { Button } from '../ui/Button';
import { Quiz } from '@shared-types';
import { Brain, Clock, ChevronRight } from 'lucide-react';

interface IDocumentQuizHistory {
  documentId: string;
  className?: string;
}

const formatTimeAgo = (date: Date | { toDate(): Date } | string): string => {
  try {
    let actualDate: Date;
    
    if (date instanceof Date) {
      actualDate = date;
    } else if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
      actualDate = date.toDate();
    } else if (typeof date === 'string') {
      actualDate = new Date(date);
    } else {
      actualDate = new Date();
    }

    const now = new Date();
    const diffInMs = now.getTime() - actualDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return `${diffInDays}d ago`;
    }
  } catch (error) {
    console.warn('Error formatting time ago:', error, date);
    return 'Recently';
  }
};

export const DocumentQuizHistory = ({ documentId, className }: IDocumentQuizHistory) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useGetDocumentQuizzesQuery({ documentId });

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain size={14} />
          Quiz History
        </div>
        <div className="text-sm text-muted-foreground">Loading quizzes...</div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className={`space-y-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain size={14} />
          Quiz History
        </div>
        <div className="text-sm text-destructive">Failed to load quiz history</div>
      </div>
    );
  }

  const quizzes = data.data?.quizzes || [];

  if (quizzes.length === 0) {
    return (
      <div className={`space-y-2 ${className || ''}`}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain size={14} />
          Quiz History
        </div>
        <div className="text-sm text-muted-foreground">No quizzes created yet</div>
      </div>
    );
  }

  const handleQuizClick = (quizId: string) => {
    navigate(`/quiz/${quizId}`);
  };

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain size={14} />
          Quiz History ({quizzes.length})
        </div>
      </div>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        {quizzes.slice(0, 3).map((quiz: Quiz) => (
          <Button
            key={quiz.id}
            variant="ghost"
            size="sm"
            onClick={() => handleQuizClick(quiz.id)}
            className="w-full justify-between h-auto p-2 text-left"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{quiz.title}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={12} />
                  {formatTimeAgo(quiz.createdAt)}
                  <span>•</span>
                  <span>{quiz.questions.length} questions</span>
                </div>
              </div>
            </div>
            <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
          </Button>
        ))}
        {quizzes.length > 3 && (
          <div className="text-xs text-muted-foreground text-center pt-1">
            +{quizzes.length - 3} more quizzes
          </div>
        )}
      </div>
    </div>
  );
};