import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useDeleteQuizMutation } from '../../store/api/Quiz/QuizApi';
import { useDeleteFlashcardSetMutation } from '../../store/api/Flashcards/FlashcardsApi';
import { useDeleteSlideDeckMutation } from '../../store/api/SlideDecks/SlideDecksApi';
import { useDeleteDiagramQuizMutation } from '../../store/api/DiagramQuiz/DiagramQuizApi';

export type ArtifactType = 'quiz' | 'flashcard' | 'slideDeck' | 'diagramQuiz';

export interface ArtifactToDelete {
  id: string;
  title: string;
  type: ArtifactType;
}

interface DeleteArtifactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: ArtifactToDelete | null;
}

const TYPE_LABELS: Record<ArtifactType, string> = {
  quiz: 'Quiz',
  flashcard: 'Flashcard Set',
  slideDeck: 'Slide Deck',
  diagramQuiz: 'Diagram Quiz',
};

export const DeleteArtifactDialog: React.FC<DeleteArtifactDialogProps> = ({
  isOpen,
  onClose,
  artifact,
}) => {
  const [deleteQuiz, { isLoading: deletingQuiz }] = useDeleteQuizMutation();
  const [deleteFlashcardSet, { isLoading: deletingFlashcard }] = useDeleteFlashcardSetMutation();
  const [deleteSlideDeck, { isLoading: deletingSlideDeck }] = useDeleteSlideDeckMutation();
  const [deleteDiagramQuiz, { isLoading: deletingDiagramQuiz }] =
    useDeleteDiagramQuizMutation();

  const isLoading =
    deletingQuiz || deletingFlashcard || deletingSlideDeck || deletingDiagramQuiz;

  const handleDelete = async () => {
    if (!artifact) return;

    try {
      switch (artifact.type) {
        case 'quiz':
          await deleteQuiz({ quizId: artifact.id }).unwrap();
          break;
        case 'flashcard':
          await deleteFlashcardSet({ flashcardSetId: artifact.id }).unwrap();
          break;
        case 'slideDeck':
          await deleteSlideDeck({ slideDeckId: artifact.id }).unwrap();
          break;
        case 'diagramQuiz':
          await deleteDiagramQuiz({ diagramQuizId: artifact.id }).unwrap();
          break;
      }
      onClose();
    } catch (error) {
      console.error(`Failed to delete ${artifact.type}:`, error);
    }
  };

  if (!artifact) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete {TYPE_LABELS[artifact.type]}
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{artifact.title}</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? (
              <>
                <Trash2 className="mr-2 h-4 w-4 animate-pulse" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
