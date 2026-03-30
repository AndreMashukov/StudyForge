export interface IDiagramAnswerBar {
  selectedAnswer: number | null;
  correctAnswer: number;
  showResult: boolean;
  onSelect: (index: number) => void;
  className?: string;
}
