import React from 'react';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { QuizCardProps } from '../types/IMyQuizzesPageTypes';
import { Play, Trash2, Calendar, Hash } from 'lucide-react';

const formatDate = (date: Date | { toDate(): Date } | string): string => {
  try {
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString();
    }
    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString();
    }
    return 'Unknown date';
  } catch (error) {
    console.warn('Failed to format date:', date, error);
    return 'Invalid date';
  }
};

export const QuizCard: React.FC<QuizCardProps> = ({ quiz, onQuizClick, onDeleteQuiz }) => {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0" onClick={() => onQuizClick(quiz.id)}>
            <h3 className="font-semibold text-lg mb-2 line-clamp-2 hover:text-primary transition-colors">
              {quiz.title}
            </h3>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                <span>{formatDate(quiz.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Hash size={14} />
                <span>{quiz.questions?.length || 0} questions</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={() => onQuizClick(quiz.id)}
              className="flex items-center gap-1"
            >
              <Play size={14} />
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteQuiz(quiz.id);
              }}
              className="flex items-center gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};