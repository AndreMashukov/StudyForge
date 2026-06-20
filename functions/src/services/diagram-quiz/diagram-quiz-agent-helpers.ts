import { z } from 'zod';
import { logger } from 'firebase-functions/v2';
import type { IArtifactAgentDiagnostics, IArtifactCriticResult } from '@shared-types';
import { DiagramQuizPromptBuilder } from '../gemini/prompt-builder';
import { LlmGenerationService } from '../llm';
import type {
  ArtifactAgentContext,
  ArtifactRepairStrategy,
} from '../artifact-agent/artifact-agent-definition';
import { recordModelUsage } from '../artifact-agent/artifact-agent-definition';
import type { IDiagramQuizDraft } from './diagram-quiz-types';
import { getFirstRepairTarget, trackDiagramQuizArtifactDetails } from './diagram-quiz-gates';

const MAX_DIAGRAM_FIXES = 12;

export const diagramQuizRepairStrategy: ArtifactRepairStrategy<IDiagramQuizDraft> = {
  async repair(draft, failures, context, diagnostics) {
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

    try {
      const startedAt = Date.now();
      const fixedDiagram = await LlmGenerationService.repairDiagramQuizDiagram({
        sourceContent: context.sourceContent,
        questionText: question.question,
        brokenDiagram,
        parseError: failureMessage,
        syntaxRules: DiagramQuizPromptBuilder.getDiagramSyntaxRulesExcerpt(),
      });
      question.diagrams[diagramIndex] = fixedDiagram;
      trackDiagramQuizArtifactDetails(diagnostics, {
        diagramsFixed: diagramsFixed + 1,
        autoRepairFailures: details.autoRepairFailures,
      });
      recordModelUsage(diagnostics, {
        role: 'repair',
        capability: 'diagramQuizAgent',
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

export const diagramQuizCriticStrategy = {
  async criticize(
    draft: IDiagramQuizDraft,
    context: ArtifactAgentContext,
    diagnostics: IArtifactAgentDiagnostics
  ): Promise<IArtifactCriticResult> {
    const startedAt = Date.now();
    const raw = await LlmGenerationService.runDiagramQuizCritic({
      sourceContent: context.sourceContent,
      draft,
    });
    recordModelUsage(diagnostics, {
      role: 'critic',
      capability: 'diagramQuizAgent',
      durationMs: Date.now() - startedAt,
    });

    try {
      const parsed = criticResultSchema.parse(JSON.parse(raw));
      return parsed;
    } catch (error) {
      logger.warn('Failed to parse diagram quiz critic response', {
        error: error instanceof Error ? error.message : String(error),
        rawPreview: raw.slice(0, 500),
      });
      return {
        overallVerdict: 'fail',
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

    const startedAt = Date.now();
    const refined = await LlmGenerationService.refineDiagramQuiz({
      sourceContent: context.sourceContent,
      draft,
      criticResult,
      failingQuestionIndexes: failingIndexes,
      enhancedPrompt: context.enhancedPrompt,
    });
    recordModelUsage(diagnostics, {
      role: 'refiner',
      capability: 'diagramQuiz',
      durationMs: Date.now() - startedAt,
    });
    return refined;
  },
};
