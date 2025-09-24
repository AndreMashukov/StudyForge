import { Quiz } from '@shared-types';

export interface IMyQuizzesPageContext {
  // Data
  quizzes: Quiz[];
  groupedQuizzes: GroupedQuizzes;
  isLoading: boolean;
  error: string | null;

  // Handlers
  handlers: {
    handleQuizClick: (quizId: string) => void;
    handleDeleteQuiz: (quizId: string) => void;
    handleRefresh: () => void;
  };
}

export interface GroupedQuizzes {
  [documentTitle: string]: Quiz[];
}

export interface QuizCardProps {
  quiz: Quiz;
  onQuizClick: (quizId: string) => void;
  onDeleteQuiz: (quizId: string) => void;
}

export interface DocumentGroupProps {
  documentTitle: string;
  quizzes: Quiz[];
  onQuizClick: (quizId: string) => void;
  onDeleteQuiz: (quizId: string) => void;
}