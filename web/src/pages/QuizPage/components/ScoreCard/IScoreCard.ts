import { IQuizStats } from '../../types/IQuizTypes';

export interface IScoreCard {
  stats: IQuizStats;
  onResetQuiz: () => void;
  className?: string;
}