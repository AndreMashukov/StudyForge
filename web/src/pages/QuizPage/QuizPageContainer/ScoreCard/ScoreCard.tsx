import React from 'react';
import { Trophy, Clock, Target, RotateCcw, Check, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { IQuizAnswer } from '../../types/IQuizTypes';
import { IScoreCard } from './IScoreCard';

const getScoreColor = (percentage: number) => {
  if (percentage >= 80) return 'text-green-400';
  if (percentage >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

const formatTime = (milliseconds: number) => {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const ScoreCard: React.FC<IScoreCard> = ({
  stats,
  onResetQuiz,
  className,
}) => {
  const { score, totalQuestions, percentage, timeTaken, answersBreakdown } = stats;

  return (
    <div className={cn('max-w-4xl mx-auto space-y-8', className)}>
      {/* Header */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Quiz Completed!
          </CardTitle>
          <p className="text-muted-foreground">
            Congratulations on completing the quiz
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 text-center">
            <Target className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className={cn('text-2xl font-bold mb-1', getScoreColor(percentage))}>
              {score}/{totalQuestions}
            </div>
            <div className="text-muted-foreground text-sm">Score</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className={cn('text-2xl font-bold mb-1', getScoreColor(percentage))}>
              {percentage}%
            </div>
            <div className="text-muted-foreground text-sm">Accuracy</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {formatTime(timeTaken)}
            </div>
            <div className="text-muted-foreground text-sm">Time</div>
          </CardContent>
        </Card>
      </div>

      {/* Results Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Review Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {answersBreakdown.map((answer: IQuizAnswer, index: number) => (
            <div 
              key={index} 
              className={cn(
                'p-4 rounded-xl border',
                answer.isCorrect 
                  ? 'bg-green-900/20 border-green-800' 
                  : 'bg-red-900/20 border-red-800'
              )}
            >
              <div className="flex items-center gap-3">
                {answer.isCorrect ? (
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <X className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <span className="text-sm text-foreground">
                  Question {index + 1}: {answer.isCorrect ? 'Correct' : 'Incorrect'}
                  {answer.selected === -1 && ' (Skipped)'}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="p-6">
          <Button
            onClick={onResetQuiz}
            className="w-full"
            size="lg"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Take Quiz Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};