import { Quiz } from '@shared-types';

export interface IMyQuizzesPageContext {
  // API data (complete objects, no destructuring)
  quizzesApi: {
    quizzes: Quiz[];
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
  };
  
  // Handlers (complete object)
  handlers: {
    handleQuizClick: (quizId: string) => void;
    handleDeleteQuiz: (quizId: string) => Promise<{ success: boolean; error?: string }>;
  };
  
  // Computed data (can't be accessed elsewhere)
  groupedQuizzes: GroupedQuizzes;
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