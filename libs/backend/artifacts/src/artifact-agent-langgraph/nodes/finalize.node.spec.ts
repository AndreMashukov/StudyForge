import { describe, expect, it, vi } from 'vitest';

import {
  createEmptyDiagnostics,
  type ArtifactGate,
} from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { IDiagramQuizDraft } from '../../diagram-quiz/diagram-quiz-types';
import { finalizeNode } from './finalize.node';
import { DiagramQuizStateValue } from '../diagram-quiz-state';

const baseDraft: IDiagramQuizDraft = {
  title: 'Test quiz',
  questions: [],
};

function buildState(
  gates: ArtifactGate<IDiagramQuizDraft>[],
  overrides: Record<string, unknown> = {},
) {
  const definition = {
    artifactKind: 'diagramQuiz',
    gates,
    persistCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
  const diagnostics = createEmptyDiagnostics(definition);
  return {
    state: {
      [ARTIFACT_PIPELINE_STATE_KEYS.definition]: definition,
      [ARTIFACT_PIPELINE_STATE_KEYS.context]: {
        userId: 'user-1',
        directoryId: 'dir-1',
        recordId: 'rec-1',
        jobId: 'job-1',
        artifactKind: 'diagramQuiz',
        documentIds: ['doc-1'],
        title: 'Test quiz',
        enhancedPrompt: '',
        appliedRuleIds: [],
        followupRuleIds: [],
        sourceContent: { title: 'Doc', content: 'content', wordCount: 1 },
      },
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: baseDraft,
      [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
      [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
      [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: {
        overallVerdict: 'fail',
        items: [{ itemIndex: 0, severity: 'blocker', issues: ['bad'] }],
      },
      [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: 'test-model',
      [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: 'test-model',
      ...overrides,
    } as typeof DiagramQuizStateValue.State,
    definition,
  };
}

describe('diagram-quiz finalizeNode', () => {
  it('persists when the critic did not pass but a fresh gate has no blockers', async () => {
    const cleanGates: ArtifactGate<IDiagramQuizDraft>[] = [
      {
        async run() {
          return [];
        },
      },
    ];
    const { state, definition } = buildState(cleanGates);

    const result = await finalizeNode(state);

    expect(definition.persistCompleted).toHaveBeenCalledOnce();
    expect(definition.markFailed).not.toHaveBeenCalled();
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('completed');
  });

  it('fails when a fresh gate still has blockers', async () => {
    const blockingGates: ArtifactGate<IDiagramQuizDraft>[] = [
      {
        async run() {
          return [
            {
              gateId: 'mermaidParse',
              severity: 'blocker',
              message: 'parse failed',
            },
          ];
        },
      },
    ];
    const { state, definition } = buildState(blockingGates);

    const result = await finalizeNode(state);

    expect(definition.markFailed).toHaveBeenCalledOnce();
    expect(definition.persistCompleted).not.toHaveBeenCalled();
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.outcome]).toBe('failed');
  });
});
