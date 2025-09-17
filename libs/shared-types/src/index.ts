// Quiz Types
export interface Quiz {
  id: string;
  urlId: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: Date;
  userId?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[]; // 4 options
  correctAnswer: number; // index of correct option
}

// URL Types
export interface UrlContent {
  id: string;
  url: string;
  title: string;
  content: string;
  extractedAt: Date;
  userId?: string;
}

// API Types
export interface GenerateQuizRequest {
  url: string;
}

export interface GenerateQuizResponse {
  quizId: string;
  quiz: Quiz;
}

export interface GetQuizResponse {
  quiz: Quiz;
}

export interface GetUserQuizzesResponse {
  quizzes: Quiz[];
}

// Auth Types
export interface User {
  uid: string;
  email: string;
  displayName?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}