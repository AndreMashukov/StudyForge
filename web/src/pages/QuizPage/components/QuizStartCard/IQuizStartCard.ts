import { IQuizQuestion } from '../../types/IQuizTypes';

export interface IQuizStartCard {
  questions: IQuizQuestion[];
  onStartQuiz: () => void;
  className?: string;
}