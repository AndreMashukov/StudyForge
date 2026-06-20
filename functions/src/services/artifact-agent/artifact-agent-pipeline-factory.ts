import { logger } from 'firebase-functions/v2';
import {
  BaseAgent,
  LoopAgent,
  SequentialAgent,
  createEvent,
  createEventActions,
} from '@google/adk';
import type { InvocationContext } from '@google/adk';
import type { ArtifactAgentDefinition, ArtifactGateFailure } from './artifact-agent-definition';
import {
  createEmptyDiagnostics,
  hasBlockerFailures,
  mergeFailuresIntoDiagnostics,
  runArtifactGates,
} from './artifact-agent-definition';
import { ArtifactAgentPipelineFailedError } from './artifact-agent-errors';

interface PipelineRuntimeState {
  definition: ArtifactAgentDefinition<unknown, unknown>;
  context?: Awaited<ReturnType<ArtifactAgentDefinition<unknown, unknown>['loadContext']>>;
  draft?: unknown;
  diagnostics: ReturnType<typeof createEmptyDiagnostics>;
  gateFailures: ArtifactGateFailure[];
  criticResult?: import('@shared-types').IArtifactCriticResult;
  outcome?: 'completed' | 'failed';
  failureMessage?: string;
  generationModel?: string;
  agentModel?: string;
}

const STATE_KEY = 'artifact_pipeline';

function getRuntime(context: InvocationContext): PipelineRuntimeState {
  const runtime = context.session.state[STATE_KEY] as PipelineRuntimeState | undefined;
  if (!runtime) {
    throw new Error('Artifact pipeline runtime state missing');
  }
  return runtime;
}

class LoadContextAgent extends BaseAgent {
  constructor(private readonly definition: ArtifactAgentDefinition<unknown, unknown>) {
    super({ name: 'loadContextAgent', description: 'Load artifact generation context' });
  }

  async *runAsyncImpl(context: InvocationContext) {
    const runtime = getRuntime(context);
    const jobInput = context.session.state.job_input as Parameters<
      ArtifactAgentDefinition<unknown, unknown>['loadContext']
    >[0];
    runtime.context = await this.definition.loadContext(jobInput);
    yield createEvent({
      author: this.name,
      actions: createEventActions({ stateDelta: { [STATE_KEY]: runtime } }),
    });
  }

  // eslint-disable-next-line require-yield
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
    const runtime = getRuntime(context);
    if (!runtime.context) {
      throw new Error('Context must be loaded before generation');
    }
    runtime.draft = await this.definition.generate(runtime.context, runtime.diagnostics);
    runtime.diagnostics.generatorAttempts += 1;
    yield createEvent({
      author: this.name,
      actions: createEventActions({ stateDelta: { [STATE_KEY]: runtime } }),
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
    const runtime = getRuntime(context);
    if (!runtime.context || runtime.draft === undefined) {
      throw new Error('Draft and context required for gate evaluation');
    }

    const gateResult = await runArtifactGates(
      this.definition.gates,
      runtime.draft,
      runtime.context
    );
    runtime.gateFailures = gateResult.failures;
    mergeFailuresIntoDiagnostics(runtime.diagnostics, gateResult.failures);

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: { [STATE_KEY]: runtime },
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
    const runtime = getRuntime(context);
    if (
      !runtime.context ||
      runtime.draft === undefined ||
      !this.definition.repair ||
      !hasBlockerFailures(runtime.gateFailures)
    ) {
      return;
    }

    runtime.draft = await this.definition.repair.repair(
      runtime.draft,
      runtime.gateFailures,
      runtime.context,
      runtime.diagnostics
    );
    runtime.diagnostics.repairCount += 1;
    yield createEvent({
      author: this.name,
      actions: createEventActions({ stateDelta: { [STATE_KEY]: runtime } }),
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
    const runtime = getRuntime(context);
    if (!runtime.context || runtime.draft === undefined || !this.definition.critic) {
      return;
    }

    runtime.criticResult = await this.definition.critic.criticize(
      runtime.draft,
      runtime.context,
      runtime.diagnostics
    );
    runtime.diagnostics.criticCycles += 1;
    runtime.diagnostics.criticIssues = runtime.criticResult;

    yield createEvent({
      author: this.name,
      actions: createEventActions({
        stateDelta: { [STATE_KEY]: runtime },
        escalate: runtime.criticResult.overallVerdict === 'pass',
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
    const runtime = getRuntime(context);
    if (
      !runtime.context ||
      runtime.draft === undefined ||
      !runtime.criticResult ||
      !this.definition.refiner
    ) {
      return;
    }

    runtime.draft = await this.definition.refiner.refine(
      runtime.draft,
      runtime.criticResult,
      runtime.context,
      runtime.diagnostics
    );
    yield createEvent({
      author: this.name,
      actions: createEventActions({ stateDelta: { [STATE_KEY]: runtime } }),
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
    const runtime = getRuntime(context);
    if (!runtime.context || runtime.draft === undefined) {
      throw new Error('Draft and context required for finalize step');
    }

    const gateResult = await runArtifactGates(
      this.definition.gates,
      runtime.draft,
      runtime.context
    );
    mergeFailuresIntoDiagnostics(runtime.diagnostics, gateResult.failures);

    const criticFailed =
      runtime.criticResult?.overallVerdict === 'fail' ||
      runtime.criticResult?.items.some((item) => item.severity === 'blocker');

    if (hasBlockerFailures(gateResult.failures) || criticFailed) {
      runtime.outcome = 'failed';
      runtime.failureMessage =
        gateResult.failures.find((failure) => failure.severity === 'blocker')?.message ||
        'Automated verification failed';
      await this.definition.markFailed({
        context: runtime.context,
        diagnostics: runtime.diagnostics,
        message: runtime.failureMessage,
      });
    } else {
      runtime.outcome = 'completed';
      await this.definition.persistCompleted({
        context: runtime.context,
        draft: runtime.draft,
        diagnostics: runtime.diagnostics,
        generationModel: runtime.generationModel,
        agentModel: runtime.agentModel,
      });
    }

    yield createEvent({
      author: this.name,
      actions: createEventActions({ stateDelta: { [STATE_KEY]: runtime } }),
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

export function createInitialPipelineState(
  definition: ArtifactAgentDefinition<unknown, unknown>
): PipelineRuntimeState {
  return {
    definition,
    diagnostics: createEmptyDiagnostics(definition),
    gateFailures: [],
  };
}

export async function runArtifactPipelineOrchestration(
  definition: ArtifactAgentDefinition<unknown, unknown>,
  input: Parameters<ArtifactAgentDefinition<unknown, unknown>['loadContext']>[0]
): Promise<void> {
  const context = await definition.loadContext(input);
  const diagnostics = createEmptyDiagnostics(definition);

  let draft = await definition.generate(context, diagnostics);
  diagnostics.generatorAttempts += 1;

  for (let repairAttempt = 0; repairAttempt < definition.limits.maxRepairIterations; repairAttempt += 1) {
    const gateResult = await runArtifactGates(definition.gates, draft, context);
    mergeFailuresIntoDiagnostics(diagnostics, gateResult.failures);
    if (!hasBlockerFailures(gateResult.failures)) {
      break;
    }
    if (!definition.repair || repairAttempt === definition.limits.maxRepairIterations - 1) {
      break;
    }
    draft = await definition.repair.repair(draft, gateResult.failures, context, diagnostics);
    diagnostics.repairCount += 1;
  }

  if (definition.critic && definition.refiner) {
    for (let criticAttempt = 0; criticAttempt < definition.limits.maxCriticIterations; criticAttempt += 1) {
      const gateResult = await runArtifactGates(definition.gates, draft, context);
      mergeFailuresIntoDiagnostics(diagnostics, gateResult.failures);
      if (hasBlockerFailures(gateResult.failures)) {
        break;
      }

      const criticResult = await definition.critic.criticize(draft, context, diagnostics);
      diagnostics.criticCycles += 1;
      diagnostics.criticIssues = criticResult;

      if (criticResult.overallVerdict === 'pass') {
        break;
      }
      if (criticResult.overallVerdict === 'fail') {
        break;
      }

      draft = await definition.refiner.refine(draft, criticResult, context, diagnostics);
    }
  }

  const finalGateResult = await runArtifactGates(definition.gates, draft, context);
  mergeFailuresIntoDiagnostics(diagnostics, finalGateResult.failures);

  const criticFailed =
    diagnostics.criticIssues?.overallVerdict === 'fail' ||
    diagnostics.criticIssues?.items.some((item) => item.severity === 'blocker');

  if (hasBlockerFailures(finalGateResult.failures) || criticFailed) {
    const message =
      finalGateResult.failures.find((failure) => failure.severity === 'blocker')?.message ||
      'Automated verification failed';
    await definition.markFailed({ context, diagnostics, message });
    logger.warn('Artifact agent pipeline failed verification', {
      artifactKind: definition.artifactKind,
      recordId: context.recordId,
      message,
    });
    throw new ArtifactAgentPipelineFailedError(message);
  }

  await definition.persistCompleted({
    context,
    draft,
    diagnostics,
  });
}
