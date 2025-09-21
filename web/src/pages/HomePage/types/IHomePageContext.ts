import { Quiz, GenerateQuizResponse } from "@shared-types";

export interface IHomePageContext {
  // URL Form state
  urlForm: {
    url: string;
    setUrl: (url: string) => void;
    isGenerating: boolean;
    error: string | null;
  };

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
  handlers: {
    handleGenerateQuiz: (documentId: string) => Promise<{ success: boolean; data?: GenerateQuizResponse; error?: string }>;
    handleNavigateToQuiz: (quizId: string) => void;
    handleDeleteQuiz: (quizId: string) => Promise<{ success: boolean }>;
  };
}