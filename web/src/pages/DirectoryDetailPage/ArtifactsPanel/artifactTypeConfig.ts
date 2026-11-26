import {
  Brain,
  Layers,
  ListOrdered,
  Network,
  Presentation,
  Puzzle,
  type LucideIcon,
} from 'lucide-react';
import type { ArtifactSummaryType } from '@shared-types';
import type { CreateArtifactModalType } from '../../../components/CreateArtifactModal';

export interface IArtifactTypeConfig {
  type: ArtifactSummaryType;
  /** Singular label shown on rows ("Quiz · 2 days ago"). */
  label: string;
  /** Creation tile label. */
  tileLabel: string;
  icon: LucideIcon;
  /** Create Artifact modal type; also the pending-generation panel key. */
  createType: CreateArtifactModalType;
  /** Viewer route segment, e.g. `quiz` for `/quiz/:id`. */
  route: string;
}

/** Display order of the creation tiles. */
export const ARTIFACT_TYPE_CONFIGS: readonly IArtifactTypeConfig[] = [
  { type: 'quiz', label: 'Quiz', tileLabel: 'Quiz', icon: Brain, createType: 'quizzes', route: 'quiz' },
  { type: 'flashcard', label: 'Flashcards', tileLabel: 'Flashcards', icon: Layers, createType: 'cards', route: 'flashcards' },
  { type: 'slideDeck', label: 'Slides', tileLabel: 'Slides', icon: Presentation, createType: 'slides', route: 'slides' },
  { type: 'diagramQuiz', label: 'Diagram quiz', tileLabel: 'Diagram quiz', icon: Network, createType: 'diagramQuizzes', route: 'diagram-quiz' },
  { type: 'sequenceQuiz', label: 'Sequence quiz', tileLabel: 'Sequence quiz', icon: ListOrdered, createType: 'sequenceQuizzes', route: 'sequence-quiz' },
  { type: 'matchQuiz', label: 'Match quiz', tileLabel: 'Match quiz', icon: Puzzle, createType: 'matchQuizzes', route: 'match-quiz' },
];

const CONFIG_BY_TYPE = new Map(
  ARTIFACT_TYPE_CONFIGS.map((config) => [config.type, config]),
);

export function getArtifactTypeConfig(
  type: ArtifactSummaryType,
): IArtifactTypeConfig {
  const config = CONFIG_BY_TYPE.get(type);
  if (!config) {
    throw new Error(`Unknown artifact type: ${type}`);
  }
  return config;
}

export function buildArtifactLink(
  type: ArtifactSummaryType,
  artifactId: string,
  directoryId: string,
): string {
  return `/${getArtifactTypeConfig(type).route}/${artifactId}?directoryId=${encodeURIComponent(directoryId)}`;
}
