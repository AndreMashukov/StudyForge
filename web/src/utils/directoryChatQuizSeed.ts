import { DirectoryChatArtifactContext } from '@shared-types';

export interface IDirectoryChatQuestionSeedInput {
  artifactType: DirectoryChatArtifactContext['type'];
  quizId: string;
  questionIndex: number;
  question: string;
  title?: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
  sequenceItems?: string[];
  userSequence?: string[];
  correctSequence?: string[];
  matchPrompts?: string[];
  userMatches?: string[];
  correctMatches?: string[];
  followupRuleIds?: string[];
}

export const buildDirectoryChatQuestionSeedKey = (
  artifactType: DirectoryChatArtifactContext['type'],
  quizId: string,
  questionIndex: number,
): string => `${artifactType}:${quizId}:${questionIndex}:question`;

export const buildDirectoryChatQuestionSeedMessage = (question: string): string =>
  `Quiz question: ${question}`;

export const buildDirectoryChatQuestionSeed = (
  input: IDirectoryChatQuestionSeedInput,
): {
  seedKey: string;
  seedMessage: string;
  artifactContext: DirectoryChatArtifactContext;
} => {
  const trimmedQuestion = input.question.trim();

  return {
    seedKey: buildDirectoryChatQuestionSeedKey(
      input.artifactType,
      input.quizId,
      input.questionIndex,
    ),
    seedMessage: buildDirectoryChatQuestionSeedMessage(trimmedQuestion),
    artifactContext: {
      type: input.artifactType,
      question: trimmedQuestion,
      ...(input.title ? { title: input.title } : {}),
      ...(input.options ? { options: input.options } : {}),
      ...(input.userAnswer ? { userAnswer: input.userAnswer } : {}),
      ...(input.correctAnswer ? { correctAnswer: input.correctAnswer } : {}),
      ...(input.explanation ? { explanation: input.explanation } : {}),
      ...(input.sequenceItems ? { sequenceItems: input.sequenceItems } : {}),
      ...(input.userSequence ? { userSequence: input.userSequence } : {}),
      ...(input.correctSequence ? { correctSequence: input.correctSequence } : {}),
      ...(input.matchPrompts ? { matchPrompts: input.matchPrompts } : {}),
      ...(input.userMatches ? { userMatches: input.userMatches } : {}),
      ...(input.correctMatches ? { correctMatches: input.correctMatches } : {}),
      ...(input.followupRuleIds
        ? { followupRuleIds: input.followupRuleIds }
        : {}),
    },
  };
};
