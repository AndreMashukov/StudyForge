import {
  BaseAgent,
  LoopAgent,
  SequentialAgent,
  createEvent,
  createEventActions,
} from '@google/adk';
import type { InvocationContext } from '@google/adk';
import type { IArtifactAgentDiagnostics, IArtifactCriticResult } from '@shared-types';
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactAgentJobInput,
  ArtifactGateFailure,
} from './artifact-agent-definition';
import {
  createEmptyDiagnostics,
  hasBlockerFailures,
  mergeFailuresIntoDiagnostics,
  runArtifactGates,
} from './artifact-agent-definition';

export const ARTIFACT_PIPELINE_STATE_KEYS = {
  definition: 'artifact_definition',
  jobInput: 'job_input',
  context: 'artifact_context',
  draft: 'artifact_draft',
  diagnostics: 'artifact_diagnostics',
  gateFailures: 'artifact_gate_failures',
  criticResult: 'artifact_critic_result',
  outcome: 'artifact_outcome',
  failureMessage: 'artifact_failure_message',
  generationModel: 'artifact_generation_model',
  agentModel: 'artifact_agent_model',
} as const;

export type ArtifactPipelineOutcome = 'completed' | 'failed';

function readContext(context: InvocationContext): ArtifactAgentContext {
  const agentContext = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.context];
  if (!agentContext) {
    throw new Error('Artifact context must be loaded before this step');
  }
  return agentContext as ArtifactAgentContext;
}

function readDiagnostics(context: InvocationContext): IArtifactAgentDiagnostics {
  const diagnostics = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics];
  if (!diagnostics) {
    throw new Error('Artifact diagnostics missing from session state');
  }
  return diagnostics as IArtifactAgentDiagnostics;
}

function readDraft(context: InvocationContext): unknown {
  const draft = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
  if (draft === undefined) {
    throw new Error('Artifact draft must be generated before this step');
  }
  return draft;
}

function readGateFailures(context: InvocationContext): ArtifactGateFailure[] {
  const gateFailures = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures];
  return Array.isArray(gateFailures) ? (gateFailures as ArtifactGateFailure[]) : [];
}

class LoadContextAgent extends BaseAgent {
  constructor(private readonly definition: ArtifactAgentDefinition<unknown, unknown>) {
    super({ name: 'loadContextAgent', description: 'Load artifact generation context' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const jobInput = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.jobInput] as ArtifactAgentJobInput;
    const loadedContext = await this.definition.loadContext(jobInput);
    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: { [ARTIFACT_PIPELINE_STATE_KEYS.context]: loadedContext },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for artifact agents');
  }
}

class GenerateAgent extends BaseAgent {
  constructor(private readonly definition: ArtifactAgentDefinition<unknown, unknown>) {
    super({ name: 'generatorAgent', description: 'Generate artifact draft' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const diagnostics = readDiagnostics(context);
    const draft = await this.definition.generate(agentContext, diagnostics);
    diagnostics.generatorAttempts += 1;

    // Prefer the latest generator usage entry that recorded a model label.
    const generatorModel = [...diagnostics.modelUsage]
      .reverse()
      .find((entry) => entry.role === 'generator' && typeof entry.model === 'string' && entry.model.trim())
      ?.model;

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [ARTIFACT_PIPELINE_STATE_KEYS.draft]: draft,
          [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
          ...(generatorModel
            ? {
                [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: generatorModel,
                [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: generatorModel,
              }
            : {}),
        },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for artifact agents');
  }
}

class GateAgent extends BaseAgent {
  constructor(private readonly definition: ArtifactAgentDefinition<unknown, unknown>) {
    super({ name: 'gateAgent', description: 'Run artifact validation gates' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const draft = readDraft(context);
    const diagnostics = readDiagnostics(context);

    const gateResult = await runArtifactGates(this.definition.gates, draft, agentContext);
    mergeFailuresIntoDiagnostics(diagnostics, gateResult.failures);

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: gateResult.failures,
          [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
        },
        escalate: !hasBlockerFailures(gateResult.failures),
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for artifact agents');
  }
}

class RepairAgent extends BaseAgent {
  constructor(private readonly definition: ArtifactAgentDefinition<unknown, unknown>) {
    super({ name: 'repairAgent', description: 'Repair artifact draft failures' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const draft = readDraft(context);
    const diagnostics = readDiagnostics(context);
    const gateFailures = readGateFailures(context);

    if (!this.definition.repair || !hasBlockerFailures(gateFailures)) {
      return;
    }

    const repairedDraft = await this.definition.repair.repair(
      draft,
      gateFailures,
      agentContext,
      diagnostics
    );
    diagnostics.repairCount += 1;
    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [ARTIFACT_PIPELINE_STATE_KEYS.draft]: repairedDraft,
          [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
        },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for artifact agents');
  }
}

class CriticAgent extends BaseAgent {
  constructor(private readonly definition: ArtifactAgentDefinition<unknown, unknown>) {
    super({ name: 'criticAgent', description: 'Critique artifact draft quality' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const draft = readDraft(context);
    const diagnostics = readDiagnostics(context);

    if (!this.definition.critic) {
      return;
    }

    const criticResult = await this.definition.critic.criticize(draft, agentContext, diagnostics);
    diagnostics.criticCycles += 1;
    diagnostics.criticIssues = criticResult;

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [ARTIFACT_PIPELINE_STATE_KEYS.criticResult]: criticResult,
          [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
        },
        escalate: criticResult.overallVerdict === 'pass',
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for artifact agents');
  }
}

class RefinerAgent extends BaseAgent {
  constructor(private readonly definition: ArtifactAgentDefinition<unknown, unknown>) {
    super({ name: 'refinerAgent', description: 'Refine artifact draft from critic feedback' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const draft = readDraft(context);
    const diagnostics = readDiagnostics(context);
    const criticResult = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.criticResult] as
      | IArtifactCriticResult
      | undefined;

    if (
      !this.definition.refiner ||
      !criticResult ||
      criticResult.overallVerdict === 'fail' ||
      criticResult.overallVerdict === 'pass'
    ) {
      return;
    }

    const refinedDraft = await this.definition.refiner.refine(
      draft,
      criticResult,
      agentContext,
      diagnostics
    );
    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: { [ARTIFACT_PIPELINE_STATE_KEYS.draft]: refinedDraft },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for artifact agents');
  }
}

class FinalizeAgent extends BaseAgent {
  constructor(private readonly definition: ArtifactAgentDefinition<unknown, unknown>) {
    super({ name: 'finalizeAgent', description: 'Persist completed or failed artifact' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const agentContext = readContext(context);
    const draft = readDraft(context);
    const diagnostics = readDiagnostics(context);
    const criticResult = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.criticResult] as
      | IArtifactCriticResult
      | undefined;
    const generationModel = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.generationModel] as
      | string
      | undefined;
    const agentModel = context.session.state[ARTIFACT_PIPELINE_STATE_KEYS.agentModel] as
      | string
      | undefined;

    const gateResult = await runArtifactGates(this.definition.gates, draft, agentContext);
    // GateAgent already records residuals during the repair loop. Only append
    // failures that are new on this final draft (e.g. after critic/refiner).
    const novelFailures = gateResult.failures.filter(
      (failure) =>
        !diagnostics.residuals.some(
          (residual) =>
            residual.gateId === failure.gateId &&
            residual.severity === failure.severity &&
            residual.message === failure.message &&
            residual.path === failure.path
        )
    );
    mergeFailuresIntoDiagnostics(diagnostics, novelFailures);

    const criticFailed =
      criticResult?.overallVerdict === 'fail' ||
      criticResult?.items.some((item) => item.severity === 'blocker');

    if (hasBlockerFailures(gateResult.failures) || criticFailed) {
      const failureMessage =
        gateResult.failures.find((failure) => failure.severity === 'blocker')?.message ||
        'Automated verification failed';
      await this.definition.markFailed({
        context: agentContext,
        diagnostics,
        message: failureMessage,
      });
      yield createEvent({
        author: this.name,
        actions: createEventActions({
          stateDelta: {
            [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
            [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed' satisfies ArtifactPipelineOutcome,
            [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: failureMessage,
          },
        }),
      });
      return;
    }

    await this.definition.persistCompleted({
      context: agentContext,
      draft,
      diagnostics,
      generationModel,
      agentModel,
    });

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: {
          [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: diagnostics,
          [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'completed' satisfies ArtifactPipelineOutcome,
        },
      }),
    });
  }

  // eslint-disable-next-line require-yield
  async *runLiveImpl() {
    throw new Error('Live mode is not supported for artifact agents');
  }
}

export function createArtifactPipeline(
  definition: ArtifactAgentDefinition<unknown, unknown>
): SequentialAgent {
  const gateAgent = new GateAgent(definition);

  const repairLoop = new LoopAgent({
    name: 'repairLoop',
    description: 'Repair loop for structural and syntax gate failures',
    maxIterations: definition.limits.maxRepairIterations,
    subAgents: [gateAgent, new RepairAgent(definition)],
  });

  const subAgents: BaseAgent[] = [
    new LoadContextAgent(definition),
    new GenerateAgent(definition),
    repairLoop,
  ];

  if (definition.critic && definition.refiner) {
    subAgents.push(
      new LoopAgent({
        name: 'verificationLoop',
        description: 'Critic/refiner verification loop',
        maxIterations: definition.limits.maxCriticIterations,
        subAgents: [new CriticAgent(definition), new RefinerAgent(definition)],
      })
    );
  }

  subAgents.push(new FinalizeAgent(definition));

  return new SequentialAgent({
    name: `${definition.artifactKind}Pipeline`,
    description: `${definition.displayName} artifact agent pipeline`,
    subAgents,
  });
}

export function createInitialSessionState(
  definition: ArtifactAgentDefinition<unknown, unknown>,
  jobInput: ArtifactAgentJobInput
): Record<string, unknown> {
  return {
    [ARTIFACT_PIPELINE_STATE_KEYS.definition]: definition,
    [ARTIFACT_PIPELINE_STATE_KEYS.jobInput]: jobInput,
    [ARTIFACT_PIPELINE_STATE_KEYS.diagnostics]: createEmptyDiagnostics(definition),
    [ARTIFACT_PIPELINE_STATE_KEYS.gateFailures]: [],
  };
}

export function readPipelineOutcome(
  sessionState: Record<string, unknown>
): ArtifactPipelineOutcome | undefined {
  const outcome = sessionState[ARTIFACT_PIPELINE_STATE_KEYS.outcome];
  if (outcome === 'completed' || outcome === 'failed') {
    return outcome;
  }
  return undefined;
}

export function readPipelineFailureMessage(sessionState: Record<string, unknown>): string {
  const message = sessionState[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage];
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : 'Automated verification failed';
}
