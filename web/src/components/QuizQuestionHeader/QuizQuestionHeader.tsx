import React from 'react';
import { CardHeader, CardTitle } from '../ui/Card';
import { QuizHintTooltip } from '../QuizHintTooltip';
import { QuizProgressBar } from '../QuizProgressBar';
import { IQuizQuestionHeader } from './IQuizQuestionHeader';

export const QuizQuestionHeader: React.FC<IQuizQuestionHeader> = ({
  progress,
  currentQuestion,
  totalQuestions,
  score,
  answeredCount,
  questionText,
  hint,
  leadingAction,
}) => {
  if (totalQuestions <= 0) {
    return null;
  }

  return (
    <>
      <QuizProgressBar
        progress={progress}
        currentQuestion={currentQuestion}
        totalQuestions={totalQuestions}
        score={score}
        answeredCount={answeredCount}
        leadingAction={leadingAction}
      />
      <CardHeader className="space-y-0 px-6 pb-3 pt-3">
        <div className="flex items-start gap-2">
          <CardTitle className="flex-1 text-base font-semibold leading-snug">
            {questionText}
          </CardTitle>
          <QuizHintTooltip hint={hint ?? undefined} className="mt-0.5" />
        </div>
      </CardHeader>
    </>
  );
};
