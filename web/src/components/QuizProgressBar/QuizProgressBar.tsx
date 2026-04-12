import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { IQuizProgressBar } from './IQuizProgressBar';

export const QuizProgressBar: React.FC<IQuizProgressBar> = ({
  progress,
  currentQuestion,
  totalQuestions,
  score,
  answeredCount,
}) => {
  return (
    <>
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out rounded-r-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-6 pt-4">
        <span className="text-xs font-medium text-muted-foreground">
          Question {currentQuestion} of {totalQuestions}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-green-500 font-semibold">{score}</span>
          <span>/ {answeredCount} correct</span>
        </span>
      </div>
    </>
  );
};
