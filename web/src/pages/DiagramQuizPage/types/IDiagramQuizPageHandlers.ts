export interface IDiagramQuizPageHandlers {
  handleAnswerSelect: (answerIndex: number) => void;
  handleNextQuestion: () => void;
  handleResetQuiz: () => void;
  handleCompleteQuiz: () => void;
  handlePrevDiagram: () => void;
  handleNextDiagram: () => void;
  handleDiagramDotClick: (index: number) => void;
  handleGenerateFollowup: () => void;
}
