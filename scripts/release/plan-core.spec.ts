import { describe, expect, it } from 'vitest';
import { PROJECT_NUMBER, WORKSPACE_AGENT_KNOWLEDGE_PATH } from './config';
import { isAllowedMember, mergePlan, validateProposal } from './plan-core';
import { renderPlanMarkdown } from './render';
import type { IFunctionExport, IReleaseFacts } from './schema';
import { workspaceAgentKnowledgeFacts } from './workspace-agent-knowledge';

const PROJECT = 'study-forge-202604';

function fn(name: string, overrides: Partial<IFunctionExport> = {}): IFunctionExport {
  return { name, trigger: 'callable', eventType: null, module: './endpoints/x', secrets: [], invoker: null, deployed: true, ...overrides };
}

function facts(overrides: Partial<IReleaseFacts> = {}): IReleaseFacts {
  return {
    project: PROJECT,
    base: 'a'.repeat(40),
    head: 'b'.repeat(40),
    mode: 'diff',
    online: true,
    changedFiles: ['functions/src/endpoints/quizzes.ts'],
    web: { deploy: false, reasons: [] },
    rules: { firestoreRules: false, firestoreIndexes: false, storageRules: false },
    workspaceAgentKnowledge: { status: 'unchanged' },
    functions: {
      exports: [fn('generateQuiz'), fn('healthCheck', { trigger: 'https' }), fn('newEndpoint', { deployed: false })],
      forceAll: { value: false, reasons: [] },
      graphAffected: [{ name: 'generateQuiz', reasons: ['imports changed functions/src/endpoints/quizzes.ts'] }],
      typeOnlyChanges: [],
      deletedFunctions: [],
      missingSecrets: [],
      runtimeServiceAccounts: [`${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`],
    },
    migrations: {
      ledgerSeeded: true,
      pending: [
        { script: 'backfill-new.ts', phase: 'post-functions', header: '/** @release-phase post-functions */', changedInDiff: true },
        { script: 'untagged.ts', phase: null, header: '/** no tag */', changedInDiff: false },
      ],
    },
    diff: { text: '', truncatedFiles: [], omittedFiles: [] },
    ...overrides,
  };
}

const emptyProposal = { summary: 'ok', extraFunctions: [], iamGrants: [], migrations: [], warnings: [] };

describe('validateProposal', () => {
  it('accepts a minimal proposal and fills defaults', () => {
    const result = validateProposal({ summary: 'nothing extra' }, facts());
    expect(result.ok).toBe(true);
  });

  it('rejects unknown keys (no free-form commands can sneak in)', () => {
    const result = validateProposal({ ...emptyProposal, shell: 'rm -rf /' }, facts());
    expect(result.ok).toBe(false);
  });

  it('rejects functions, migrations and roles that are not allowed', () => {
    const result = validateProposal(
      {
        ...emptyProposal,
        extraFunctions: [{ name: 'madeUp', reason: 'x' }],
        migrations: [
          { script: 'untagged.ts', reason: 'x' },
          { script: 'update-credit-price-to-2-5-cents.ts', reason: 'x' },
        ],
      },
      facts(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('"madeUp" is not an exported function');
      expect(result.errors.join('\n')).toContain('"untagged.ts" is not a pending migration');
      expect(result.errors.join('\n')).toContain('update-credit-price');
    }
  });

  it('rejects a role outside the allowlist at schema level', () => {
    const result = validateProposal(
      {
        ...emptyProposal,
        iamGrants: [{ role: 'roles/owner', resourceType: 'function', resource: 'generateQuiz', member: 'allUsers', reason: 'x' }],
      },
      facts(),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects public access proposed by the LLM', () => {
    const result = validateProposal(
      {
        ...emptyProposal,
        iamGrants: [{ role: 'roles/run.invoker', resourceType: 'function', resource: 'healthCheck', member: 'allUsers', reason: 'x' }],
      },
      facts(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('"allUsers" is not allowed');
  });

  it('rejects a role paired with the wrong resource type', () => {
    const result = validateProposal(
      {
        ...emptyProposal,
        iamGrants: [{ role: 'roles/pubsub.publisher', resourceType: 'function', resource: 'generateQuiz', member: 'allUsers', reason: 'x' }],
      },
      facts(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('must target a pubsubTopic');
  });
});

describe('isAllowedMember', () => {
  const NUMBER = '853327102927';

  it('never allows allUsers', () => {
    expect(isAllowedMember('allUsers', PROJECT, NUMBER)).toBe(false);
  });

  it('allows this project service accounts and Google service agents only', () => {
    expect(isAllowedMember(`serviceAccount:worker-sa@${PROJECT}.iam.gserviceaccount.com`, PROJECT, NUMBER)).toBe(true);
    expect(isAllowedMember(`serviceAccount:${NUMBER}-compute@developer.gserviceaccount.com`, PROJECT, NUMBER)).toBe(true);
    expect(isAllowedMember(`serviceAccount:service-${NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com`, PROJECT, NUMBER)).toBe(true);
    expect(isAllowedMember('serviceAccount:evil@other-project.iam.gserviceaccount.com', PROJECT, NUMBER)).toBe(false);
    expect(isAllowedMember('user:someone@example.com', PROJECT, NUMBER)).toBe(false);
  });

  it('rejects compute accounts and service agents of other projects', () => {
    expect(isAllowedMember('serviceAccount:111111111111-compute@developer.gserviceaccount.com', PROJECT, NUMBER)).toBe(false);
    expect(isAllowedMember('serviceAccount:service-111111111111@gcp-sa-pubsub.iam.gserviceaccount.com', PROJECT, NUMBER)).toBe(false);
  });
});

describe('mergePlan', () => {
  it('schedules knowledge publishing and re-indexing even when the LLM only returns a summary', () => {
    const changedFiles = [WORKSPACE_AGENT_KNOWLEDGE_PATH];
    const workspaceAgentKnowledge = workspaceAgentKnowledgeFacts(new Set(changedFiles), () => 'abc\n');
    const plan = mergePlan(facts({ changedFiles, workspaceAgentKnowledge }), emptyProposal, 'model');

    expect(plan.workspaceAgentKnowledgeHash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(renderPlanMarkdown(plan, { preview: true })).toContain(
      `Publish changes from \`${WORKSPACE_AGENT_KNOWLEDGE_PATH}\` to Firestore and wait for re-indexing.`,
    );
  });

  it('skips knowledge publishing for other documents', () => {
    const changedFiles = [`${WORKSPACE_AGENT_KNOWLEDGE_PATH}.bak`, 'docs/other.md'];
    const workspaceAgentKnowledge = workspaceAgentKnowledgeFacts(new Set(changedFiles), () => 'abc');
    const plan = mergePlan(facts({ changedFiles, workspaceAgentKnowledge }), emptyProposal, 'model');

    expect(plan.workspaceAgentKnowledgeHash).toBeNull();
    expect(renderPlanMarkdown(plan, { preview: true })).not.toContain('Platform agent knowledge');
  });

  it.each([null, '\n '])('blocks a changed knowledge source with no content (%j)', (source) => {
    const changedFiles = [WORKSPACE_AGENT_KNOWLEDGE_PATH];
    const workspaceAgentKnowledge = workspaceAgentKnowledgeFacts(new Set(changedFiles), () => source);
    const plan = mergePlan(facts({ changedFiles, workspaceAgentKnowledge }), emptyProposal, 'model');

    expect(plan.workspaceAgentKnowledgeHash).toBeNull();
    expect(plan.blockers).toEqual([expect.stringContaining(WORKSPACE_AGENT_KNOWLEDGE_PATH)]);
  });

  it('keeps the graph floor and new exports, and adds the public invoker for new callables', () => {
    const plan = mergePlan(facts(), emptyProposal, 'model');
    expect(plan.functions.map((entry) => entry.name)).toEqual(['generateQuiz', 'newEndpoint']);
    expect(plan.iamGrants).toEqual([
      expect.objectContaining({ role: 'roles/run.invoker', resource: 'newEndpoint', member: 'allUsers', source: 'deterministic' }),
    ]);
    expect(plan.blockers).toEqual([]);
  });

  it('does not make a new HTTPS function public when its invoker option is private', () => {
    const base = facts();
    const plan = mergePlan(
      {
        ...base,
        functions: {
          ...base.functions,
          exports: [
            fn('privateHook', { trigger: 'https', invoker: ['private'], deployed: false }),
            fn('publicHook', { trigger: 'https', invoker: ['public'], deployed: false }),
          ],
          graphAffected: [],
        },
      },
      emptyProposal,
      'model',
    );
    expect(plan.functions.map((entry) => entry.name)).toEqual(['privateHook', 'publicHook']);
    expect(plan.iamGrants.map((grant) => grant.resource)).toEqual(['publicHook']);
  });

  it('cannot drop graph-affected functions: the LLM can only add', () => {
    const plan = mergePlan(facts(), { ...emptyProposal, extraFunctions: [{ name: 'healthCheck', reason: 'reads changed doc' }] }, 'model');
    const healthCheck = plan.functions.find((entry) => entry.name === 'healthCheck');
    expect(healthCheck?.sources).toEqual(['llm']);
    expect(plan.functions.map((entry) => entry.name)).toContain('generateQuiz');
  });

  it('takes the migration phase from the script tag, never from the LLM', () => {
    const plan = mergePlan(facts(), { ...emptyProposal, migrations: [{ script: 'backfill-new.ts', reason: 'backs new field' }] }, 'model');
    expect(plan.migrations).toEqual([{ script: 'backfill-new.ts', phase: 'post-functions', reason: 'backs new field' }]);
    expect(plan.manualActions.join('\n')).toContain('untagged.ts');
  });

  it('deploy-all ships every function and every tagged pending migration without an LLM', () => {
    const plan = mergePlan(
      facts({
        mode: 'deploy-all',
        functions: { ...facts().functions, forceAll: { value: true, reasons: ['deploy_all'] } },
      }),
      null,
      null,
    );
    expect(plan.planner).toBe('none');
    expect(plan.functions).toHaveLength(3);
    expect(plan.migrations.map((entry) => entry.script)).toEqual(['backfill-new.ts']);
  });

  it('blocks on missing secrets used by planned functions and on an unseeded ledger', () => {
    const base = facts();
    const plan = mergePlan(
      {
        ...base,
        functions: {
          ...base.functions,
          exports: [fn('generateQuiz', { secrets: ['NEW_KEY'] }), ...base.functions.exports.slice(1)],
          missingSecrets: ['NEW_KEY'],
        },
        migrations: { ...base.migrations, ledgerSeeded: false },
      },
      emptyProposal,
      'model',
    );
    expect(plan.blockers).toHaveLength(2);
  });

  it('keeps only the first 5 LLM warnings instead of failing the plan', () => {
    const warnings = Array.from({ length: 8 }, (_, i) => `warning ${i + 1}`);
    expect(validateProposal({ ...emptyProposal, warnings }, facts()).ok).toBe(true);
    const plan = mergePlan(facts(), { ...emptyProposal, warnings }, 'model');
    expect(plan.warnings).toEqual(warnings.slice(0, 5));
  });

  it('reports deleted functions as manual actions instead of deleting them', () => {
    const base = facts();
    const plan = mergePlan({ ...base, functions: { ...base.functions, deletedFunctions: ['oldFn'] } }, emptyProposal, 'model');
    expect(plan.functions.map((entry) => entry.name)).not.toContain('oldFn');
    expect(plan.manualActions.join('\n')).toContain('oldFn');
  });
});
