export interface IProgressBar {
  progress: number;
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  className?: string;
}