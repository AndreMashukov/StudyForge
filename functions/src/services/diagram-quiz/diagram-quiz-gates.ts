import type { DiagramQuizQuestion } from '@shared-types';
import {
  BANNED_DIAGRAM_TYPES,
  SUPPORTED_DIAGRAM_TYPES,
  extractDiagramType,
  extractMermaidFillSignatures,
  validateMermaidDiagram,
} from '../mermaid';
import type {
  ArtifactAgentContext,
  ArtifactGate,
  ArtifactGateFailure,
} from '../artifact-agent/artifact-agent-definition';
import type { IDiagramQuizDraft } from './diagram-quiz-types';

const MAX_NODES_HEURISTIC = 12;

function validateSchema(draft: IDiagramQuizDraft): ArtifactGateFailure[] {
  const failures: ArtifactGateFailure[] = [];

  if (!draft.title || typeof draft.title !== 'string') {
    failures.push({
      gateId: 'schema',
      severity: 'blocker',
      message: 'Missing quiz title',
      path: 'title',
    });
  }

  if (!Array.isArray(draft.questions) || draft.questions.length === 0) {
    failures.push({
      gateId: 'schema',
      severity: 'blocker',
      message: 'Quiz must contain at least one question',
      path: 'questions',
    });
    return failures;
  }

  draft.questions.forEach((question, questionIndex) => {
    validateQuestionStructure(question, questionIndex, failures);
  });

  return failures;
}

function validateQuestionStructure(
  question: DiagramQuizQuestion,
  questionIndex: number,
  failures: ArtifactGateFailure[]
): void {
  const basePath = `questions[${questionIndex}]`;

  if (!question.question || typeof question.question !== 'string') {
    failures.push({
      gateId: 'schema',
      severity: 'blocker',
      message: `Question ${questionIndex + 1}: invalid question text`,
      path: `${basePath}.question`,
    });
  }

  if (!Array.isArray(question.diagrams) || question.diagrams.length !== 4) {
    failures.push({
      gateId: 'schema',
      severity: 'blocker',
      message: `Question ${questionIndex + 1}: diagrams must contain exactly 4 entries`,
      path: `${basePath}.diagrams`,
      repairTarget: { questionIndex },
    });
  } else {
    question.diagrams.forEach((diagram, diagramIndex) => {
      if (typeof diagram !== 'string' || diagram.trim().length === 0) {
        failures.push({
          gateId: 'schema',
          severity: 'blocker',
          message: `Question ${questionIndex + 1}, diagram ${diagramIndex + 1}: empty diagram source`,
          path: `${basePath}.diagrams[${diagramIndex}]`,
          repairTarget: { questionIndex, diagramIndex },
        });
      }
    });
  }

  if (
    typeof question.correctAnswer !== 'number' ||
    question.correctAnswer < 0 ||
    question.correctAnswer > 3
  ) {
    failures.push({
      gateId: 'schema',
      severity: 'blocker',
      message: `Question ${questionIndex + 1}: correctAnswer must be 0-3`,
      path: `${basePath}.correctAnswer`,
      repairTarget: { questionIndex },
    });
  }

  if (!question.explanation || question.explanation.trim().length === 0) {
    failures.push({
      gateId: 'schema',
      severity: 'blocker',
      message: `Question ${questionIndex + 1}: missing explanation`,
      path: `${basePath}.explanation`,
      repairTarget: { questionIndex },
    });
  }
}

function validatePolicy(draft: IDiagramQuizDraft): ArtifactGateFailure[] {
  const failures: ArtifactGateFailure[] = [];

  draft.questions.forEach((question, questionIndex) => {
    question.diagrams.forEach((diagram, diagramIndex) => {
      const diagramType = extractDiagramType(diagram);
      const path = `questions[${questionIndex}].diagrams[${diagramIndex}]`;

      if (!diagramType) {
        failures.push({
          gateId: 'diagramPolicy',
          severity: 'blocker',
          message: `Question ${questionIndex + 1}, diagram ${diagramIndex + 1}: unknown diagram type`,
          path,
          repairTarget: { questionIndex, diagramIndex },
        });
        return;
      }

      if (BANNED_DIAGRAM_TYPES.has(diagramType)) {
        failures.push({
          gateId: 'diagramPolicy',
          severity: 'blocker',
          message: `Question ${questionIndex + 1}, diagram ${diagramIndex + 1}: banned diagram type "${diagramType}"`,
          path,
          repairTarget: { questionIndex, diagramIndex },
        });
        return;
      }

      if (!SUPPORTED_DIAGRAM_TYPES.has(diagramType)) {
        failures.push({
          gateId: 'diagramPolicy',
          severity: 'blocker',
          message: `Question ${questionIndex + 1}, diagram ${diagramIndex + 1}: unsupported diagram type "${diagramType}"`,
          path,
          repairTarget: { questionIndex, diagramIndex },
        });
      }

      const nodeCount = diagram.split('\n').filter((line) => line.trim().length > 0).length;
      if (nodeCount > MAX_NODES_HEURISTIC + 2) {
        failures.push({
          gateId: 'diagramPolicy',
          severity: 'warning',
          message: `Question ${questionIndex + 1}, diagram ${diagramIndex + 1}: diagram may be too large (${nodeCount} lines)`,
          path,
          repairTarget: { questionIndex, diagramIndex },
        });
      }
    });
  });

  return failures;
}

async function validateMermaidParse(draft: IDiagramQuizDraft): Promise<ArtifactGateFailure[]> {
  const failures: ArtifactGateFailure[] = [];

  for (let questionIndex = 0; questionIndex < draft.questions.length; questionIndex += 1) {
    const question = draft.questions[questionIndex];
    const fillSignatures = question.diagrams.map((diagram) => extractMermaidFillSignatures(diagram));
    const uniqueFillSets = new Set(fillSignatures.map((fills) => fills.join('|')));

    if (uniqueFillSets.size > 1 && fillSignatures.some((fills) => fills.length > 0)) {
      failures.push({
        gateId: 'visualNeutrality',
        severity: 'blocker',
        message: `Question ${questionIndex + 1}: answer options use inconsistent color palettes`,
        path: `questions[${questionIndex}].diagrams`,
        repairTarget: { questionIndex, diagramIndex: 0 },
      });
    }

    for (let diagramIndex = 0; diagramIndex < question.diagrams.length; diagramIndex += 1) {
      const diagram = question.diagrams[diagramIndex];
      const result = await validateMermaidDiagram(diagram);
      if (!result.ok) {
        failures.push({
          gateId: 'mermaidParse',
          severity: 'blocker',
          message: `Question ${questionIndex + 1}, diagram ${diagramIndex + 1}: ${result.error || 'Mermaid parse failed'}`,
          path: `questions[${questionIndex}].diagrams[${diagramIndex}]`,
          repairTarget: { questionIndex, diagramIndex },
        });
      } else if (result.sanitized !== diagram) {
        question.diagrams[diagramIndex] = result.sanitized;
      }
    }
  }

  return failures;
}

function validateAnswerDistribution(draft: IDiagramQuizDraft): ArtifactGateFailure[] {
  const failures: ArtifactGateFailure[] = [];
  const answers = draft.questions.map((question) => question.correctAnswer);
  const uniqueAnswers = new Set(answers);

  if (draft.questions.length >= 4 && uniqueAnswers.size === 1) {
    failures.push({
      gateId: 'answerDistribution',
      severity: 'warning',
      message: 'All correct answers share the same option index; distractor distribution may be weak',
      path: 'questions[].correctAnswer',
    });
  }

  return failures;
}

export const diagramQuizSchemaGate: ArtifactGate<IDiagramQuizDraft> = {
  id: 'schema',
  run: async (draft) => validateSchema(draft),
};

export const diagramQuizPolicyGate: ArtifactGate<IDiagramQuizDraft> = {
  id: 'diagramPolicy',
  run: async (draft) => validatePolicy(draft),
};

export const diagramQuizMermaidGate: ArtifactGate<IDiagramQuizDraft> = {
  id: 'mermaidParse',
  run: async (draft) => validateMermaidParse(draft),
};

export const diagramQuizAnswerDistributionGate: ArtifactGate<IDiagramQuizDraft> = {
  id: 'answerDistribution',
  run: async (draft) => validateAnswerDistribution(draft),
};

export const diagramQuizGates: ArtifactGate<IDiagramQuizDraft>[] = [
  diagramQuizSchemaGate,
  diagramQuizPolicyGate,
  diagramQuizMermaidGate,
  diagramQuizAnswerDistributionGate,
];

export function getFirstRepairTarget(
  failures: ArtifactGateFailure[]
): { questionIndex: number; diagramIndex: number } | null {
  for (const failure of failures) {
    if (failure.severity !== 'blocker' || !failure.repairTarget) {
      continue;
    }
    if (typeof failure.repairTarget.questionIndex === 'number') {
      return {
        questionIndex: failure.repairTarget.questionIndex,
        diagramIndex: failure.repairTarget.diagramIndex ?? 0,
      };
    }
  }
  return null;
}

export function trackDiagramQuizArtifactDetails(
  diagnostics: import('@shared-types').IArtifactAgentDiagnostics,
  details: {
    diagramsFixed?: number;
    autoRepairFailures?: Array<{
      questionIndex: number;
      diagramIndex: number;
      lastError: string;
    }>;
  }
): void {
  const merged: Record<string, unknown> = { ...(diagnostics.artifactDetails || {}) };
  if (details.diagramsFixed !== undefined) {
    merged.diagramsFixed = details.diagramsFixed;
  }
  if (details.autoRepairFailures !== undefined) {
    merged.autoRepairFailures = details.autoRepairFailures;
  }
  diagnostics.artifactDetails = merged;
}

export type { ArtifactAgentContext };
