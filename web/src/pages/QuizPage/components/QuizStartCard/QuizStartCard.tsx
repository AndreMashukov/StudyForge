import React from 'react';
import { Play } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { IQuizStartCard } from './IQuizStartCard';

export const QuizStartCard: React.FC<IQuizStartCard> = ({
  questions,
  onStartQuiz,
  className,
}) => {
  return (
    <Card className={cn('max-w-2xl mx-auto', className)}>
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Play className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Ready to Start the Quiz?
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">
            Test your knowledge with {questions.length} carefully crafted questions.
          </p>
          <p className="text-sm text-muted-foreground">
            Take your time and read each question carefully.
          </p>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-foreground text-sm">Quiz Information:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• {questions.length} questions total</li>
            <li>• Multiple choice format</li>
            <li>• Instant feedback after each answer</li>
            <li>• Detailed explanations provided</li>
          </ul>
        </div>

        <Button
          onClick={onStartQuiz}
          className="w-full"
          size="lg"
        >
          <Play className="w-5 h-5 mr-2" />
          Start Quiz
        </Button>
      </CardContent>
    </Card>
  );
};