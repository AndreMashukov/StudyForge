import React from 'react';
import { QuizCard } from './QuizCard';
import { IDocumentGroup } from '../types/IMyQuizzesPageTypes';
import { FileText } from 'lucide-react';

export const DocumentGroup: React.FC<IDocumentGroup> = ({
  documentTitle,
  quizzes,
  onQuizClick,
  onDeleteQuiz,
}) => {
  // Sort quizzes by creation date (most recent first)
  const sortedQuizzes = [...quizzes].sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b">
        <FileText size={20} className="text-primary" />
        <h2 className="text-xl font-semibold">{documentTitle}</h2>
        <span className="text-sm text-muted-foreground ml-2">
          ({quizzes.length} quiz{quizzes.length !== 1 ? 'es' : ''})
        </span>
      </div>
      
      <div className="space-y-3">
        {sortedQuizzes.map((quiz) => (
          <QuizCard
            key={quiz.id}
            quiz={quiz}
            onQuizClick={onQuizClick}
            onDeleteQuiz={onDeleteQuiz}
          />
        ))}
      </div>
    </div>
  );
};