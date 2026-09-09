import { describe, expect, it, vi } from 'vitest';

import type { IArtifactCriticResult } from '@shared-types';

import {
  createEmptyDiagnostics,
  type ArtifactAgentDefinition,
} from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import { DiagramQuizStateValue } from '../diagram-quiz-state';
import { refinerNode } from './refiner.node';

const draft = { questions: [{ prompt: 'q1' }] };

function criticResult(
  overallVerdict: IArtifactCriticResult['overallVerdict'],
): IArtifactCriticResult {
  return {
    overallVerdict,
    items: [
      {
        itemIndex: 0,
        severity: overallVerdict === 'revise' ? 'warning' : 'ok',
        issues: overallVerdict === 'revise' ? ['needs a clearer label'] : [],
      },
    ],
  };
}

function buildState(options: {
  definition: ArtifactAgentDefinition<unknown, unknown>;
  criticResult?: IArtifactCriticResult;
}) {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.definition]: options.definition,
    [ARTIFACT_PIPELINE_STATE_KEYS.context]: {
      userId: 'user-1',
      directoryId: 'dir-1',
      recordId: 'rec-1',
      jobId: 'job-1',
      artifactKind: 'diagramQuiz',
      documentIds: ['doc-1'],
      title: 'Test diagram quiz',
      enhancedPrompt: '',
      appliedRuleIds: [],
      followupRuleIds: [],
      sourceContent: { title: 'Doc', content: 'content', wordCount: 1 },
    },
    [ARTIFACT_PIPELINE_STATE_KEYS.draft]: draft,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: createEmptyDiagnostics({
      artifactKind: 'diagramQuiz',
      agentDefinitionVersion: 'test',
    }),
    [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: options.criticResult,
  } as typeof DiagramQuizStateValue.State;
}

function definitionWithRefiner(
  refine: ReturnType<typeof vi.fn>,
): ArtifactAgentDefinition<unknown, unknown> {
  return {
    artifactKind: 'diagramQuiz',
    refiner: { refine },
  } as unknown as ArtifactAgentDefinition<unknown, unknown>;
}

describe('diagram quiz refinerNode', () => {
  it('passes the draft through when the critic has not run yet', async () => {
    const refine = vi.fn();
    const result = await refinerNode(
      buildState({ definition: definitionWithRefiner(refine) }),
    );

    expect(refine).not.toHaveBeenCalled();
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.draft]).toEqual(draft);
  });

  it('does not call refine for pass or fail verdicts', async () => {
    const refine = vi.fn();
    const definition = definitionWithRefiner(refine);

    await refinerNode(
      buildState({ definition, criticResult: criticResult('pass') }),
    );
    await refinerNode(
      buildState({ definition, criticResult: criticResult('fail') }),
    );

    expect(refine).not.toHaveBeenCalled();
  });

  it('refines when the critic asks for a revision', async () => {
    const refinedDraft = { questions: [{ prompt: 'q1-refined' }] };
    const refine = vi.fn().mockResolvedValue(refinedDraft);
    const result = await refinerNode(
      buildState({
        definition: definitionWithRefiner(refine),
        criticResult: criticResult('revise'),
      }),
    );

    expect(refine).toHaveBeenCalledTimes(1);
    expect(result[ARTIFACT_PIPELINE_STATE_KEYS.draft]).toEqual(refinedDraft);
  });
});
