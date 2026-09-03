import { MatchQuizOption } from '@shared-types';
import { IMatchQuizViewQuestion } from '../../../store/slices/matchQuizPageSlice';

export type { IMatchQuizViewQuestion, MatchQuizOption };

export interface IMatchQuizPageHandlers {
  handlePlaceOption: (promptId: string, optionId: string) => void;
  handleRemoveOption: (promptId: string) => void;
  handleResetBoard: () => void;
  handleCheckAnswer: () => void;
  handleNextQuestion: () => void;
  handleCompleteQuiz: () => void;
  handleResetQuiz: () => void;
  handleGenerateFollowup: () => void;
}