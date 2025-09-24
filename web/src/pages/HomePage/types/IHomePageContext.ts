import { Quiz } from "@shared-types";

export interface IHomePageHandlers {
  // Recent quizzes data
  recentQuizzes: {
    data: Quiz[] | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
  };

  // User's quiz history
  userQuizzes: {
    data: Quiz[] | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
  };

  // Handler functions
  handleNavigateToQuiz: (quizId: string) => void;
  handleDeleteQuiz: (quizId: string) => Promise<{ success: boolean }>;
}

export interface IHomePageContext {
  handlers: IHomePageHandlers;
}