import { z } from 'zod';
import { logger } from 'firebase-functions/v2';
import type { IArtifactAgentDiagnostics, IArtifactCriticResult } from '@shared-types';
import { JsonSanitizer } from '@study-forge/backend-llm/llm/json-sanitizer';
import { DiagramQuizPromptBuilder } from '@study-forge/backend-llm/llm/prompt-builder';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';
import type {
  ArtifactAgentContext,
  ArtifactGateFailure,
  ArtifactRepairStrategy,
} from '../artifact-definition';
import { recordModelUsage } from '../artifact-definition';
import type { IDiagramQuizDraft } from './diagram-quiz-types';
import { getFirstRepairTarget, trackDiagramQuizArtifactDetails } from './diagram-quiz-gates';
import {
  diagramQuizRepairTargetKey,
  readDiagramQuizEscalationDetails,
  recordDiagramQuizRepairAttempt,
  resolveDiagramQuizAgentRouteCapability,
  resolveDiagramQuizRefineRouteCapability,
} from './diagram-quiz-escalation';

const MAX_DIAGRAM_FIXES = 12;

function ensureArtifactDetails(
  diagnostics: IArtifactAgentDiagnostics,
): Record<string, unknown> {
  if (!diagnostics.artifactDetails || typeof diagnostics.artifactDetails !== 'object') {
    diagnostics.artifactDetails = {};
  }
  return diagnostics.artifactDetails as Record<string, unknown>;
}

function assertFourDiagrams(
  diagrams: string[]
): [string, string, string, string] {
  if (diagrams.length !== 4 || diagrams.some((diagram) => !diagram?.trim())) {
    throw new Error('Question must contain exactly 4 non-empty diagrams');
  }
  return [diagrams[0], diagrams[1], diagrams[2], diagrams[3]];
}

function findVisualComplexityFailure(
  failures: ArtifactGateFailure[]
): ArtifactGateFailure | undefined {
  return failures.find(
    (failure) => failure.severity === 'blocker' && failure.gateId === 'visualComplexity'
  );
}

export const diagramQuizRepairStrategy: ArtifactRepairStrategy<IDiagramQuizDraft> = {
  async repair(draft, failures, context, diagnostics) {
    const details = (diagnostics.artifactDetails || {}) as {
      diagramsFixed?: number;
      autoRepairFailures?: Array<{
        questionIndex: number;
        diagramIndex: number;
        lastError: string;
      }>;
    };
    const diagramsFixed = details.diagramsFixed ?? 0;
    if (diagramsFixed >= MAX_DIAGRAM_FIXES) {
      return draft;
    }

    const complexityFailure = findVisualComplexityFailure(failures);
    if (complexityFailure && typeof complexityFailure.repairTarget?.questionIndex === 'number') {
      const questionIndex = complexityFailure.repairTarget.questionIndex;
      const question = draft.questions[questionIndex];
      if (!question) {
        return draft;
      }

      const artifactDetails = ensureArtifactDetails(diagnostics);
      const targetKey = diagramQuizRepairTargetKey(questionIndex);
      const escalationDetails = readDiagramQuizEscalationDetails(artifactDetails);
      const routeCapability = resolveDiagramQuizAgentRouteCapability(
        escalationDetails,
        targetKey,
      );

      try {
        const startedAt = Date.now();
        const rebalanced = await LlmGenerationService.rebalanceDiagramQuizQuestion(
          context.userId,
          {
            sourceContent: context.sourceContent,
            questionText: question.question,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            diagrams: assertFourDiagrams(question.diagrams),
            validationError: complexityFailure.message,
            syntaxRules: DiagramQuizPromptBuilder.getDiagramSyntaxRulesExcerpt(),
            routeCapability,
          }
        );
        question.diagrams = [...rebalanced];
        trackDiagramQuizArtifactDetails(diagnostics, {
          diagramsFixed: diagramsFixed + 4,
        });
        recordModelUsage(diagnostics, {
          role: 'repair',
          capability: routeCapability,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        const autoRepairFailures = [...(details.autoRepairFailures || [])];
        autoRepairFailures.push({
          questionIndex,
          diagramIndex: complexityFailure.repairTarget.diagramIndex ?? 0,
          lastError: error instanceof Error ? error.message : String(error),
        });
        trackDiagramQuizArtifactDetails(diagnostics, {
          diagramsFixed,
          autoRepairFailures,
        });
      } finally {
        recordDiagramQuizRepairAttempt(artifactDetails, targetKey);
      }

      return draft;
    }

    const target = getFirstRepairTarget(failures);
    if (!target) {
      return draft;
    }

    const { questionIndex, diagramIndex } = target;
    const question = draft.questions[questionIndex];
    if (!question) {
      return draft;
    }

    const brokenDiagram = question.diagrams[diagramIndex];
    const failureMessage =
      failures.find(
        (failure) =>
          failure.repairTarget?.questionIndex === questionIndex &&
          (failure.repairTarget.diagramIndex ?? diagramIndex) === diagramIndex
      )?.message || 'Diagram failed validation';

    const artifactDetails = ensureArtifactDetails(diagnostics);
    const targetKey = diagramQuizRepairTargetKey(questionIndex, diagramIndex);
    const escalationDetails = readDiagramQuizEscalationDetails(artifactDetails);
    const routeCapability = resolveDiagramQuizAgentRouteCapability(
      escalationDetails,
      targetKey,
    );

    try {
      const startedAt = Date.now();
      const fixedDiagram = await LlmGenerationService.repairDiagramQuizDiagram(context.userId, {
        sourceContent: context.sourceContent,
        questionText: question.question,
        brokenDiagram,
        parseError: failureMessage,
        syntaxRules: DiagramQuizPromptBuilder.getDiagramSyntaxRulesExcerpt(),
        routeCapability,
      });
      question.diagrams[diagramIndex] = fixedDiagram;
      trackDiagramQuizArtifactDetails(diagnostics, {
        diagramsFixed: diagramsFixed + 1,
      });
      recordModelUsage(diagnostics, {
        role: 'repair',
        capability: routeCapability,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const autoRepairFailures = [...(details.autoRepairFailures || [])];
      autoRepairFailures.push({
        questionIndex,
        diagramIndex,
        lastError: error instanceof Error ? error.message : String(error),
      });
      trackDiagramQuizArtifactDetails(diagnostics, {
        diagramsFixed,
        autoRepairFailures,
      });
    } finally {
      recordDiagramQuizRepairAttempt(artifactDetails, targetKey);
    }

    return draft;
  },
};

const criticResultSchema = z.object({
  overallVerdict: z.enum(['pass', 'revise', 'fail']),
  items: z.array(
    z.object({
      itemIndex: z.number().int().min(0),
      severity: z.enum(['ok', 'warning', 'blocker']),
      issues: z.array(z.string()),
    })
  ),
});

function parseDiagramQuizCriticJson(raw: string): unknown {
  let cleaned = JsonSanitizer.initialCleanup(raw);
  cleaned = JsonSanitizer.sanitizeJsonText(cleaned);
  cleaned = JsonSanitizer.applyComprehensiveCleanup(cleaned);
  cleaned = JsonSanitizer.applyStateBased(cleaned);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    JsonSanitizer.logParsingError(error, raw, cleaned);
    return JsonSanitizer.tryFallbackParsing(cleaned);
  }
}

export const diagramQuizCriticStrategy = {
  async criticize(
    draft: IDiagramQuizDraft,
    context: ArtifactAgentContext,
    diagnostics: IArtifactAgentDiagnostics
  ): Promise<IArtifactCriticResult> {
    const artifactDetails = ensureArtifactDetails(diagnostics);
    const escalationDetails = readDiagramQuizEscalationDetails(artifactDetails);
    const routeCapability = resolveDiagramQuizRefineRouteCapability(escalationDetails);
    const criticCapability =
      routeCapability === 'escalation' ? 'escalation' : 'diagramQuizAgent';

    const startedAt = Date.now();
    const raw = await LlmGenerationService.runDiagramQuizCritic(context.userId, {
      sourceContent: context.sourceContent,
      draft,
      styleRules: DiagramQuizPromptBuilder.getDiagramSyntaxRulesExcerpt(),
      routeCapability: criticCapability,
    });
    recordModelUsage(diagnostics, {
      role: 'critic',
      capability: criticCapability,
      durationMs: Date.now() - startedAt,
    });

    try {
      return criticResultSchema.parse(parseDiagramQuizCriticJson(raw));
    } catch (error) {
      logger.warn('Failed to parse diagram quiz critic response; skipping critic gate', {
        error: error instanceof Error ? error.message : String(error),
        rawPreview: raw.slice(0, 500),
      });
      return {
        overallVerdict: 'pass',
        items: draft.questions.map((_question, itemIndex) => ({
          itemIndex,
          severity: 'ok' as const,
          issues: [],
        })),
      };
    }
  },
};

export const diagramQuizRefinerStrategy = {
  async refine(
    draft: IDiagramQuizDraft,
    criticResult: IArtifactCriticResult,
    context: ArtifactAgentContext,
    diagnostics: IArtifactAgentDiagnostics
  ): Promise<IDiagramQuizDraft> {
    const failingIndexes = criticResult.items
      .filter((item) => item.severity !== 'ok')
      .map((item) => item.itemIndex);

    if (failingIndexes.length === 0) {
      return draft;
    }

    const artifactDetails = ensureArtifactDetails(diagnostics);
    const routeCapability = resolveDiagramQuizRefineRouteCapability(
      readDiagramQuizEscalationDetails(artifactDetails),
    );

    const startedAt = Date.now();
    try {
      const refined = await LlmGenerationService.refineDiagramQuiz(context.userId, {
        sourceContent: context.sourceContent,
        draft,
        criticResult,
        failingQuestionIndexes: failingIndexes,
        enhancedPrompt: context.enhancedPrompt,
        routeCapability,
      });
      recordModelUsage(diagnostics, {
        role: 'refiner',
        capability: routeCapability,
        durationMs: Date.now() - startedAt,
      });
      return refined;
    } catch (error) {
      logger.warn('Diagram quiz refine failed; keeping pre-refine draft', {
        error: error instanceof Error ? error.message : String(error),
        failingIndexes,
      });
      recordModelUsage(diagnostics, {
        role: 'refiner',
        capability: routeCapability,
        durationMs: Date.now() - startedAt,
      });
      return draft;
    }
  },
};
