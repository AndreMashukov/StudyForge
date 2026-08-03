import {
  BaseAgent,
  LoopAgent,
  SequentialAgent,
  createEvent,
  createEventActions,
} from '@google/adk';
import type { InvocationContext } from '@google/adk';
import type { IArtifactAgentDiagnostics } from '@shared-types';
import { DocumentCrudService } from '../document-crud';
import {
  extractDocumentTitle,
  normalizeGeneratedHtml,
  normalizeGeneratedHtmlFragment,
  validateDocumentHtml,
  wrapHtmlDocument,
} from '../document-html';
import type { ValidationReport } from '../document-html/types';
import { formatGenerationModelLabel } from '@study-forge/backend-llm/llm';
import {
  critiqueRulesAdherence,
  draftDocumentHtml,
  formatValidationErrorsForRepair,
  planDocumentHtml,
  refineDocumentHtml,
  repairDocumentHtml,
  type DocumentPlan,
} from './document-agent-llm';
import type { DocumentAgentContext } from './document-agent-runner';

const STATE_KEYS = {
  agentContext: 'agentContext',
  diagnostics: 'diagnostics',
  htmlFragment: 'htmlFragment',
  validationReport: 'validationReport',
  plan: 'plan',
  repairCount: 'repairCount',
  criticFindings: 'criticFindings',
  wrappedHtml: 'wrappedHtml',
  generationModel: 'generationModel',
  outcome: 'outcome',
  failureMessage: 'failureMessage',
} as const;

type PipelineOutcome = 'completed' | 'failed';

const MAX_REPAIR_ITERATIONS = 2;
const MAX_CRITIC_ITERATIONS = 2;

function readContext(context: InvocationContext): DocumentAgentContext {
  const value = context.session.state[STATE_KEYS.agentContext];
  if (!value) {
    throw new Error('Document agent context missing from session state');
  }
  return value as DocumentAgentContext;
}

function readDiagnostics(context: InvocationContext): IArtifactAgentDiagnostics {
  const value = context.session.state[STATE_KEYS.diagnostics];
  if (!value) {
    throw new Error('Document agent diagnostics missing from session state');
  }
  return value as IArtifactAgentDiagnostics;
}

function readHtmlFragment(context: InvocationContext): string {
  const value = context.session.state[STATE_KEYS.htmlFragment];
  return typeof value === 'string' ? value : '';
}

function readValidationReport(context: InvocationContext): ValidationReport | null {
  const value = context.session.state[STATE_KEYS.validationReport];
  return value && typeof value === 'object' ? (value as ValidationReport) : null;
}

function readRepairCount(context: InvocationContext): number {
  const value = context.session.state[STATE_KEYS.repairCount];
  return typeof value === 'number' ? value : 0;
}

class PlanAgent extends BaseAgent {
  constructor() {
    super({ name: 'planAgent', description: 'Plan document outline' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const diagnostics = readDiagnostics(context);
    const plan = await planDocumentHtml(
      agentContext.userId,
      agentContext.userPrompt,
      agentContext.rules,
      diagnostics
    );
    yield createEvent({
      author: this.name,
      actions: createEventActions({ stateDelta: { [STATE_KEYS.plan]: plan } }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for document agents');
  }
}

class GenerateAgent extends BaseAgent {
  constructor() {
    super({ name: 'generateAgent', description: 'Draft HTML fragment' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const diagnostics = readDiagnostics(context);
    const plan = context.session.state[STATE_KEYS.plan] as DocumentPlan | undefined;
    const htmlFragment = normalizeGeneratedHtmlFragment(
      await draftDocumentHtml(
        agentContext.userId,
        agentContext.userPrompt,
        agentContext.rulesText,
        agentContext.files,
        plan,
        diagnostics
      )
    );

    const generatorModel = [...diagnostics.modelUsage]
      .reverse()
      .find((entry) => entry.role === 'generator' && entry.model)?.model;

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [STATE_KEYS.htmlFragment]: htmlFragment,
          [STATE_KEYS.diagnostics]: diagnostics,
          ...(generatorModel ? { [STATE_KEYS.generationModel]: generatorModel } : {}),
        },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for document agents');
  }
}

class ValidateAgent extends BaseAgent {
  constructor() {
    super({ name: 'validateAgent', description: 'Validate HTML fragment' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const htmlFragment = readHtmlFragment(context);
    const validationReport = await validateDocumentHtml(htmlFragment);
    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: { [STATE_KEYS.validationReport]: validationReport },
        escalate: validationReport.passed,
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for document agents');
  }
}

class RepairAgent extends BaseAgent {
  constructor() {
    super({ name: 'repairAgent', description: 'Repair invalid HTML fragment' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const diagnostics = readDiagnostics(context);
    const validationReport = readValidationReport(context);
    const plan = context.session.state[STATE_KEYS.plan] as DocumentPlan | undefined;
    const repairCount = readRepairCount(context) + 1;

    if (!validationReport || validationReport.passed) {
      return;
    }

    const repaired = normalizeGeneratedHtmlFragment(
      await repairDocumentHtml(
        agentContext.userId,
        agentContext.userPrompt,
        agentContext.rulesText,
        readHtmlFragment(context),
        formatValidationErrorsForRepair(validationReport.findings),
        plan,
        diagnostics
      )
    );

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [STATE_KEYS.htmlFragment]: repaired,
          [STATE_KEYS.diagnostics]: diagnostics,
          [STATE_KEYS.repairCount]: repairCount,
        },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for document agents');
  }
}

class CriticAgent extends BaseAgent {
  constructor() {
    super({ name: 'criticAgent', description: 'Critique rule adherence' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const diagnostics = readDiagnostics(context);
    const critic = await critiqueRulesAdherence(
      agentContext.userId,
      agentContext.userPrompt,
      agentContext.rules,
      readHtmlFragment(context),
      diagnostics
    );

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [STATE_KEYS.criticFindings]: critic.findings,
          [STATE_KEYS.diagnostics]: diagnostics,
        },
        escalate: critic.passed,
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for document agents');
  }
}

class RefinerAgent extends BaseAgent {
  constructor() {
    super({ name: 'refinerAgent', description: 'Refine HTML based on critic feedback' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const diagnostics = readDiagnostics(context);
    const criticFindings = context.session.state[STATE_KEYS.criticFindings];
    if (typeof criticFindings !== 'string' || !criticFindings.trim()) {
      return;
    }

    const refined = normalizeGeneratedHtmlFragment(
      await refineDocumentHtml(
        agentContext.userId,
        agentContext.userPrompt,
        agentContext.rulesText,
        readHtmlFragment(context),
        criticFindings,
        diagnostics
      )
    );

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [STATE_KEYS.htmlFragment]: refined,
          [STATE_KEYS.diagnostics]: diagnostics,
        },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for document agents');
  }
}

class FinalizeAgent extends BaseAgent {
  constructor() {
    super({ name: 'finalizeAgent', description: 'Wrap and persist completed document' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const diagnostics = readDiagnostics(context);
    const validationReport = readValidationReport(context);
    const repairCount = readRepairCount(context);

    if (!validationReport?.passed) {
      yield createEvent({
        author: this.name,
        actions: createEventActions({
          stateDelta: {
            [STATE_KEYS.outcome]: 'failed' satisfies PipelineOutcome,
            [STATE_KEYS.failureMessage]:
              formatValidationErrorsForRepair(validationReport?.findings ?? []) ||
              'Document validation failed',
          },
        }),
      });
      return;
    }

    const htmlFragment = normalizeGeneratedHtml(readHtmlFragment(context));
    const title =
      agentContext.titleHint?.trim() ||
      extractDocumentTitle(htmlFragment, 'html') ||
      'Generated Document';
    const wrappedHtml = wrapHtmlDocument(htmlFragment, title);
    const generationModelLabel =
      (context.session.state[STATE_KEYS.generationModel] as string | undefined) ||
      formatGenerationModelLabel({ providerType: 'gemini', model: 'gemini', connectionId: 'default' });

    await DocumentCrudService.completePendingDocument(
      agentContext.userId,
      agentContext.documentId,
      wrappedHtml,
      {
        title,
        description: agentContext.description,
        tags: agentContext.tags,
        appliedRuleIds: agentContext.appliedRuleIds,
        generationModel: generationModelLabel,
        generationModelUsage: diagnostics.modelUsage.length
          ? [
              {
                kind: 'documentFromPrompt',
                role: 'agent',
                workflow: 'agentic',
                modality: 'text',
                providerKind: 'gemini',
                connectionId: 'default',
                model: generationModelLabel,
                durationMs: diagnostics.modelUsage.reduce(
                  (total, entry) => total + (entry.durationMs ?? 0),
                  0
                ),
              },
            ]
          : undefined,
        generationDiagnostics: {
          ...diagnostics,
          artifactDetails: {
            repairCount,
            criticCycles: diagnostics.criticCycles,
          },
        },
        contentFormat: 'html',
      }
    );

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [STATE_KEYS.wrappedHtml]: wrappedHtml,
          [STATE_KEYS.outcome]: 'completed' satisfies PipelineOutcome,
        },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for document agents');
  }
}

export function createDocumentPipeline(): SequentialAgent {
  const repairLoop = new LoopAgent({
    name: 'repairLoop',
    description: 'Repair loop for HTML validation failures',
    maxIterations: MAX_REPAIR_ITERATIONS,
    subAgents: [new ValidateAgent(), new RepairAgent()],
  });

  const verificationLoop = new LoopAgent({
    name: 'verificationLoop',
    description: 'Critic/refiner verification loop',
    maxIterations: MAX_CRITIC_ITERATIONS,
    subAgents: [new RefinerAgent(), new CriticAgent(), new ValidateAgent()],
  });

  return new SequentialAgent({
    name: 'documentHtmlPipeline',
    description: 'StudyForge document HTML generation pipeline',
    subAgents: [
      new PlanAgent(),
      new GenerateAgent(),
      repairLoop,
      new CriticAgent(),
      verificationLoop,
      new FinalizeAgent(),
    ],
  });
}

export function readPipelineOutcome(state: Record<string, unknown>): PipelineOutcome | undefined {
  const outcome = state[STATE_KEYS.outcome];
  if (outcome === 'completed' || outcome === 'failed') {
    return outcome;
  }
  return undefined;
}

export function readPipelineFailureMessage(state: Record<string, unknown>): string {
  const message = state[STATE_KEYS.failureMessage];
  return typeof message === 'string' && message.trim()
    ? message
    : 'Document agent pipeline failed';
}
