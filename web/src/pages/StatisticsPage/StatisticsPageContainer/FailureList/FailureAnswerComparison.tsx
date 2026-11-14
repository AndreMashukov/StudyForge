import type { StatisticsRecentFailure } from '@shared-types';
import { Check, X } from 'lucide-react';
import { MermaidDiagram } from '../../../../components/MermaidDiagram';
import { cn } from '../../../../lib/utils';

interface IFailureAnswerComparison {
  failure: StatisticsRecentFailure;
}

interface ISequenceAnswer {
  items: string[];
  correctItems: string[];
  correct: boolean;
}

const SequenceAnswer = ({ items, correctItems, correct }: ISequenceAnswer) => (
  <ol className="list-decimal space-y-2 pl-5">
    {items.map((item, index) => (
      <li
        key={`${index}-${item}`}
        className={cn(
          'pl-1',
          !correct && item !== correctItems[index] && 'text-destructive',
        )}
      >
        {item}
      </li>
    ))}
  </ol>
);

export const FailureAnswerComparison = ({
  failure,
}: IFailureAnswerComparison) => {
  if (failure.quizType === 'matchQuiz') {
    if (!failure.matchPairs?.length)
      return (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Match answer text unavailable. Open the quiz to check its question
          content.
        </p>
      );
    return (
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full table-fixed text-left text-xs sm:text-sm">
          <caption className="sr-only">
            Your matches compared with the correct matches
          </caption>
          <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="p-2 font-medium sm:p-3">
                Prompt
              </th>
              <th scope="col" className="p-2 font-medium sm:p-3">
                Your match
              </th>
              <th scope="col" className="p-2 font-medium sm:p-3">
                Correct match
              </th>
            </tr>
          </thead>
          <tbody>
            {failure.matchPairs.map((pair, index) => (
              <tr key={index} className="border-t align-top">
                <th scope="row" className="break-words p-2 font-medium sm:p-3">
                  {pair.prompt}
                </th>
                <td
                  className={cn(
                    'break-words p-2 sm:p-3',
                    pair.isCorrect
                      ? 'text-success'
                      : 'bg-destructive/5 text-destructive',
                  )}
                >
                  {pair.selectedText}
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {pair.isCorrect ? (
                      <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                    ) : (
                      <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                    )}
                    {pair.isCorrect ? 'Correct pair' : 'Incorrect pair'}
                  </span>
                </td>
                <td className="break-words bg-primary/5 p-2 sm:p-3">
                  {pair.correctText}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const selectedItems = Array.isArray(failure.selectedAnswer)
    ? failure.selectedAnswer.map(String)
    : [];
  const correctItems = Array.isArray(failure.correctAnswer)
    ? failure.correctAnswer.map(String)
    : [];
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
      {[false, true].map((correct) => {
        const code = correct
          ? failure.correctDiagramCode
          : failure.selectedDiagramCode;
        return (
          <div
            key={String(correct)}
            className={cn(
              'min-w-0 rounded-lg border p-4 text-sm leading-relaxed',
              correct
                ? 'border-primary/20 bg-primary/5'
                : 'border-destructive/20 bg-destructive/5',
            )}
          >
            <p
              className={cn(
                'mb-3 flex items-center gap-2 text-xs font-medium',
                correct ? 'text-primary' : 'text-destructive',
              )}
            >
              {correct ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {correct ? 'Correct answer' : 'Your answer'}
            </p>
            {failure.quizType === 'diagramQuiz' ? (
              code ? (
                <MermaidDiagram code={code} className="min-h-[180px]" />
              ) : (
                <p className="text-muted-foreground">
                  Diagram unavailable. Open the quiz to check its content.
                </p>
              )
            ) : failure.quizType === 'sequenceQuiz' &&
              (correct ? correctItems : selectedItems).length ? (
              <SequenceAnswer
                items={correct ? correctItems : selectedItems}
                correctItems={correctItems}
                correct={correct}
              />
            ) : (
              <p className="break-words">
                {correct
                  ? failure.correctAnswerLabel
                  : failure.selectedAnswerLabel}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
