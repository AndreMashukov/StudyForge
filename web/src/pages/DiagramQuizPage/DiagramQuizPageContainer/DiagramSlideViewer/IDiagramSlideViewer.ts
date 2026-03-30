export interface IDiagramSlideViewer {
  diagrams: string[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onDotClick: (index: number) => void;
  className?: string;
}
