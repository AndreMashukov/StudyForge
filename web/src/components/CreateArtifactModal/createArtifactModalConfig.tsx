import React from 'react';
import {
  Box,
  Brain,
  Layers,
  ListOrdered,
  Network,
  Presentation,
} from 'lucide-react';
import { RuleApplicability } from '@shared-types';
import { ICreateArtifactModalConfig, CreateArtifactModalType } from './ICreateArtifactModal';

export const CREATE_ARTIFACT_MODAL_CONFIG: Record<
  CreateArtifactModalType,
  ICreateArtifactModalConfig
> = {
  quizzes: {
    title: 'Create quiz',
    icon: <Brain size={18} className="shrink-0 text-primary" />,
    nameFieldLabel: 'Quiz name',
    defaultNameFn: (docTitle) => `Quiz from ${docTitle}`,
    additionalPromptPlaceholder:
      'e.g., Focus on AWS VPC related paragraphs, make questions more challenging, etc.',
    additionalPromptHelperText: 'Provide specific instructions to customize your quiz generation',
    ruleApplicability: RuleApplicability.QUIZ,
    followupRuleApplicability: RuleApplicability.FOLLOWUP,
    generateLabels: {
      single: 'Generate quiz',
      plural: (count) => `Generate quiz from ${count} documents`,
    },
    directoryTab: 'quizzes',
  },
  cards: {
    title: 'Create flashcards',
    icon: <Layers size={18} className="shrink-0 text-primary" />,
    nameFieldLabel: 'Flashcard set name',
    defaultNameFn: (docTitle) => `Flashcards for ${docTitle}`,
    additionalPromptPlaceholder:
      'e.g., Focus on key definitions, include code examples, make cards more detailed, etc.',
    additionalPromptHelperText:
      'Provide specific instructions to customize your flashcard generation',
    ruleApplicability: RuleApplicability.FLASHCARD,
    descriptionRuleApplicability: RuleApplicability.FLASHCARD_DESC,
    generateLabels: {
      single: 'Generate flashcards',
      plural: (count) => `Generate flashcards from ${count} documents`,
    },
    directoryTab: 'cards',
  },
  slides: {
    title: 'Create slide deck',
    icon: <Presentation size={18} className="shrink-0 text-primary" />,
    nameFieldLabel: 'Slide deck name',
    defaultNameFn: (docTitle) => `Slides for ${docTitle}`,
    additionalPromptPlaceholder:
      'e.g., Focus on architecture diagrams, keep slides concise, use more visuals, etc.',
    additionalPromptHelperText:
      'Provide specific instructions to customize your slide deck generation',
    ruleApplicability: RuleApplicability.SLIDE_DECK,
    generateLabels: {
      single: 'Generate slide deck',
      plural: (count) => `Generate slide deck from ${count} documents`,
    },
    directoryTab: 'slides',
  },
  diagramQuizzes: {
    title: 'Create diagram quiz',
    icon: <Network size={18} className="shrink-0 text-primary" />,
    nameFieldLabel: 'Quiz name',
    additionalPromptPlaceholder:
      'e.g. Focus on architecture diagrams, use sequence diagrams only, etc.',
    additionalPromptHelperText: 'Customize how Mermaid diagrams are generated',
    ruleApplicability: RuleApplicability.DIAGRAM_QUIZ,
    followupRuleApplicability: RuleApplicability.FOLLOWUP,
    generateLabels: {
      single: 'Generate diagram quiz',
      plural: (count) => `Generate diagram quiz from ${count} documents`,
    },
    directoryTab: 'diagramQuizzes',
  },
  sequenceQuizzes: {
    title: 'Create sequence quiz',
    icon: <ListOrdered size={18} className="shrink-0 text-primary" />,
    nameFieldLabel: 'Quiz name',
    additionalPromptPlaceholder:
      'e.g. Focus on sentence construction, decompose algorithm steps, use historical events, etc.',
    additionalPromptHelperText:
      'Specialise how sequences are generated. Without rules, Gemini infers meaningful orderings from the source content.',
    ruleApplicability: RuleApplicability.SEQUENCE_QUIZ,
    followupRuleApplicability: RuleApplicability.FOLLOWUP,
    generateLabels: {
      single: 'Generate sequence quiz',
      plural: (count) => `Generate sequence quiz from ${count} documents`,
    },
    directoryTab: 'sequenceQuizzes',
  },
  subjectWorlds: {
    title: 'Create subject world',
    icon: <Box size={18} className="shrink-0 text-primary" />,
    nameFieldLabel: 'World name',
    additionalPromptPlaceholder:
      'e.g. Focus on hands-on exploration, more quiz gates, outdoor theme…',
    additionalPromptHelperText: 'Customize how the explorable world is generated',
    ruleApplicability: RuleApplicability.SUBJECT_WORLD,
    followupRuleApplicability: RuleApplicability.FOLLOWUP,
    generateLabels: {
      single: 'Generate subject world',
      plural: (count) => `Generate subject world from ${count} documents`,
    },
    directoryTab: 'subjectWorlds',
  },
};

export function getCreateArtifactModalConfig(
  artifactType: CreateArtifactModalType,
): ICreateArtifactModalConfig {
  return CREATE_ARTIFACT_MODAL_CONFIG[artifactType];
}
