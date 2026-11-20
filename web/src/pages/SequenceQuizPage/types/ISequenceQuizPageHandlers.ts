export interface ISequenceQuizPageHandlers {
  handlePlaceItem: (item: string, atIndex?: number) => void;
  handleRemoveItem: (item: string) => void;
  handleReorderPlacedItem: (fromIndex: number, toIndex: number) => void;
  handleResetBoard: () => void;
  handleCheckAnswer: () => void;
  handleNextQuestion: () => void;
  handleCompleteQuiz: () => void;
  handleResetQuiz: () => void;
}
