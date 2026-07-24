import type { ArtifactKind } from '@shared-types';
import type { ArtifactAgentDefinition } from './artifact-agent-definition';
import { diagramQuizDefinition } from '../diagram-quiz/diagram-quiz-definition';
import { flashcardsDefinition } from '../flashcards/flashcard-definition';

const registry = new Map<ArtifactKind, ArtifactAgentDefinition<unknown, unknown>>();

function register<TDraft, TPayload>(
  definition: ArtifactAgentDefinition<TDraft, TPayload>
): void {
  registry.set(
    definition.artifactKind,
    definition as ArtifactAgentDefinition<unknown, unknown>
  );
}

register(diagramQuizDefinition);
register(flashcardsDefinition);

export class ArtifactAgentRegistry {
  static get<TDraft = unknown, TPayload = unknown>(
    artifactKind: ArtifactKind
  ): ArtifactAgentDefinition<TDraft, TPayload> {
    const definition = registry.get(artifactKind);
    if (!definition) {
      throw new Error(`No artifact agent definition registered for kind: ${artifactKind}`);
    }
    return definition as ArtifactAgentDefinition<TDraft, TPayload>;
  }

  static listKinds(): ArtifactKind[] {
    return [...registry.keys()];
  }
}
