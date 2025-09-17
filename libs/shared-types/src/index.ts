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

// API Error Types
export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Gemini Integration Types
export interface GeminiQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface GeminiQuizResponse {
  title: string;
  questions: GeminiQuizQuestion[];
}

// Web Scraping Types
export interface ScrapedContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: string;
  wordCount: number;
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