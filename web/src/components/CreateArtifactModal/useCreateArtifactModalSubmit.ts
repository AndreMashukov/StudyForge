import { useCallback } from 'react';
import { DocumentEnhanced } from '@shared-types';
import { useGenerateQuizMutation } from '../../store/api/Quiz/QuizApi';
import { useGenerateFlashcardsMutation } from '../../store/api/Flashcards/FlashcardsApi';
import { useGenerateSlideDeckMutation } from '../../store/api/SlideDecks/SlideDecksApi';
import { useGenerateDiagramQuizMutation } from '../../store/api/DiagramQuiz/DiagramQuizApi';
import { useGenerateSequenceQuizMutation } from '../../store/api/SequenceQuiz/SequenceQuizApi';
import { useGenerateMatchQuizMutation } from '../../store/api/MatchQuiz/MatchQuizApi';
import { CreateArtifactFormSchema } from './createArtifactModalSchemas';
import { CreateArtifactModalType } from './ICreateArtifactModal';

interface IUseCreateArtifactModalSubmitArgs {
  artifactType: CreateArtifactModalType;
  directoryId: string;
  documents: DocumentEnhanced[];
}

export function useCreateArtifactModalSubmit({
  artifactType,
  directoryId,
}: IUseCreateArtifactModalSubmitArgs) {
  const [generateQuiz] = useGenerateQuizMutation();
  const [generateFlashcards] = useGenerateFlashcardsMutation();
  const [generateSlideDeck] = useGenerateSlideDeckMutation();
  const [generateDiagramQuiz] = useGenerateDiagramQuizMutation();
  const [generateSequenceQuiz] = useGenerateSequenceQuizMutation();
  const [generateMatchQuiz] = useGenerateMatchQuizMutation();

  const submit = useCallback(
    (formData: CreateArtifactFormSchema) => {
      if (!formData.documentIds?.length || !directoryId) {
        return false;
      }

      const trimmedName = formData.name?.trim();
      const trimmedPrompt = formData.additionalPrompt?.trim();
      const ruleIds = formData.ruleIds ?? [];
      const followupRuleIds = formData.followupRuleIds ?? [];
      const descriptionRuleIds = formData.descriptionRuleIds ?? [];

      switch (artifactType) {
        case 'quizzes':
          generateQuiz({
            documentIds: formData.documentIds,
            directoryId,
            quizName: trimmedName || undefined,
            additionalPrompt: trimmedPrompt || undefined,
            ruleIds,
            followupRuleIds,
            ruleResolutionMode: 'explicit-only',
          });
          break;
        case 'cards': {
          generateFlashcards({
            documentIds: formData.documentIds,
            directoryId,
            ...(trimmedName ? { title: trimmedName } : {}),
            ...(trimmedPrompt ? { additionalPrompt: trimmedPrompt } : {}),
            ruleIds,
            descriptionRuleIds,
            ruleResolutionMode: 'explicit-only',
          });
          break;
        }
        case 'slides':
          generateSlideDeck({
            documentIds: formData.documentIds,
            directoryId,
            title: trimmedName || undefined,
            additionalPrompt: trimmedPrompt || undefined,
            ruleIds,
            ruleResolutionMode: 'explicit-only',
          });
          break;
        case 'diagramQuizzes':
          generateDiagramQuiz({
            documentIds: formData.documentIds,
            directoryId,
            diagramQuizName: trimmedName || undefined,
            additionalPrompt: trimmedPrompt || undefined,
            ruleIds,
            followupRuleIds,
            ruleResolutionMode: 'explicit-only',
          });
          break;
        case 'sequenceQuizzes':
          generateSequenceQuiz({
            documentIds: formData.documentIds,
            directoryId,
            sequenceQuizName: trimmedName || undefined,
            additionalPrompt: trimmedPrompt || undefined,
            ruleIds,
            followupRuleIds,
            ruleResolutionMode: 'explicit-only',
          });
          break;
        case 'matchQuizzes':
          generateMatchQuiz({
            documentIds: formData.documentIds,
            directoryId,
            matchQuizName: trimmedName || undefined,
            additionalPrompt: trimmedPrompt || undefined,
            ruleIds,
            followupRuleIds,
            ruleResolutionMode: 'explicit-only',
          });
          break;
        default:
          return false;
      }

      return true;
    },
    [
      artifactType,
      directoryId,
      generateDiagramQuiz,
      generateFlashcards,
      generateMatchQuiz,
      generateQuiz,
      generateSequenceQuiz,
      generateSlideDeck,
    ],
  );

  return { submit };
}
