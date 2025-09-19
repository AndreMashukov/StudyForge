import React from 'react';
import { Card, CardContent } from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';

interface IProgressBarProps {
  progress: number;
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  className?: string;
}

export const ProgressBar: React.FC<IProgressBarProps> = ({
  progress,
  currentQuestion,
  totalQuestions,
  score,
  className,
}) => {
  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-6">
        {/* Header with question info */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Quiz Progress
          </h2>
          <div className="text-sm text-muted-foreground">
            Question {currentQuestion} of {totalQuestions}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-3 mb-4">
          <div 
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Stats */}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progress: {Math.round(progress)}%</span>
          <span>Score: {score}/{currentQuestion > 0 ? currentQuestion : 0}</span>
        </div>
      </CardContent>
    </Card>
  );
};