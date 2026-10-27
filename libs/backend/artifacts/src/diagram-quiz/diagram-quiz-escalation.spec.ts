import { describe, expect, it } from 'vitest';
import {
  diagramQuizRepairTargetKey,
  readDiagramQuizEscalationDetails,
  recordCriticLoopEscalationSignal,
  recordDiagramQuizRepairAttempt,
  resolveDiagramQuizAgentRouteCapability,
  resolveDiagramQuizRefineRouteCapability,
  shouldUseEscalationForCriticOrRefiner,
} from './diagram-quiz-escalation';
import { createEmptyDiagnostics } from '../artifact-definition';

describe('diagram-quiz escalation', () => {
  const targetKey = diagramQuizRepairTargetKey(3, 1);
  const otherKey = diagramQuizRepairTargetKey(0, 0);

  it('uses diagramQuizAgent for the first two repair attempts on a target', () => {
    const details = readDiagramQuizEscalationDetails({});
    expect(resolveDiagramQuizAgentRouteCapability(details, targetKey)).toBe(
      'diagramQuizAgent',
    );
  });

  it('uses escalation on the third repair attempt for the same target', () => {
    const artifactDetails: Record<string, unknown> = {};
    recordDiagramQuizRepairAttempt(artifactDetails, targetKey);
    recordDiagramQuizRepairAttempt(artifactDetails, targetKey);
    const details = readDiagramQuizEscalationDetails(artifactDetails);
    expect(resolveDiagramQuizAgentRouteCapability(details, targetKey)).toBe(
      'escalation',
    );
  });

  it('keeps other diagrams on diagramQuizAgent until they hit the threshold', () => {
    const artifactDetails: Record<string, unknown> = {};
    recordDiagramQuizRepairAttempt(artifactDetails, targetKey);
    recordDiagramQuizRepairAttempt(artifactDetails, targetKey);
    const details = readDiagramQuizEscalationDetails(artifactDetails);
    expect(resolveDiagramQuizAgentRouteCapability(details, otherKey)).toBe(
      'diagramQuizAgent',
    );
  });

  it('does not escalate critic or refiner after repair attempts alone', () => {
    const artifactDetails: Record<string, unknown> = {};
    recordDiagramQuizRepairAttempt(artifactDetails, targetKey);
    recordDiagramQuizRepairAttempt(artifactDetails, targetKey);
    const details = readDiagramQuizEscalationDetails(artifactDetails);
    expect(shouldUseEscalationForCriticOrRefiner(details)).toBe(false);
    expect(resolveDiagramQuizRefineRouteCapability(details)).toBe('diagramQuiz');
  });

  it('escalates critic and refiner after two completed non-pass critic results', () => {
    const diagnostics = createEmptyDiagnostics({
      artifactKind: 'diagramQuiz',
    });
    recordCriticLoopEscalationSignal(diagnostics, {
      completedCriticIterations: 2,
      lastVerdict: 'revise',
    });
    const details = readDiagramQuizEscalationDetails(
      diagnostics.artifactDetails,
    );
    expect(shouldUseEscalationForCriticOrRefiner(details)).toBe(true);
    expect(resolveDiagramQuizRefineRouteCapability(details)).toBe('escalation');
  });

  it('does not escalate critic loop after one non-pass critic result', () => {
    const diagnostics = createEmptyDiagnostics({
      artifactKind: 'diagramQuiz',
    });
    recordCriticLoopEscalationSignal(diagnostics, {
      completedCriticIterations: 1,
      lastVerdict: 'revise',
    });
    const details = readDiagramQuizEscalationDetails(
      diagnostics.artifactDetails,
    );
    expect(shouldUseEscalationForCriticOrRefiner(details)).toBe(false);
  });

  it('ignores invalid stored repair attempt counts', () => {
    const details = readDiagramQuizEscalationDetails({
      repairAttemptsByTarget: {
        [targetKey]: '2',
        [otherKey]: -1,
        q1: Number.POSITIVE_INFINITY,
        q2: Number.NaN,
        q3: 1,
      },
    });

    expect(details.repairAttemptsByTarget).toEqual({ q3: 1 });
    expect(resolveDiagramQuizAgentRouteCapability(details, targetKey)).toBe(
      'diagramQuizAgent',
    );
  });

  it('starts a fresh count when the stored value is invalid', () => {
    const artifactDetails: Record<string, unknown> = {
      repairAttemptsByTarget: { [targetKey]: '2' },
    };

    const details = recordDiagramQuizRepairAttempt(artifactDetails, targetKey);

    expect(details.repairAttemptsByTarget).toEqual({ [targetKey]: 1 });
  });
});
