/**
 * Pure Release plan logic: validate an LLM proposal against the facts, then merge it with
 * the deterministic floor. Nothing here touches the network or the filesystem.
 */
import { LLM_IAM_ALLOWLIST } from './config';
import {
  llmProposalSchema,
  type FunctionSource,
  type IPlannedFunction,
  type IPlannedIamGrant,
  type IPlannedMigration,
  type IReleaseFacts,
  type IReleasePlan,
  type LlmProposal,
} from './schema';

const PUBLIC_INVOKER_TRIGGERS = new Set(['callable', 'https']);
export const TASK_QUEUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/;
export const TOPIC_PATTERN = /^[A-Za-z][A-Za-z0-9._~%+-]{2,254}$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Members an LLM grant may target: this project's service accounts and Google service agents. */
export function isAllowedMember(member: string, role: string, project: string): boolean {
  if (member === 'allUsers') return role === 'roles/run.invoker';
  const projectSa = new RegExp(`^serviceAccount:[a-z][a-z0-9-]{4,28}[a-z0-9]@${escapeRegExp(project)}\\.iam\\.gserviceaccount\\.com$`);
  const appEngineSa = new RegExp(`^serviceAccount:${escapeRegExp(project)}@appspot\\.gserviceaccount\\.com$`);
  const computeSa = /^serviceAccount:\d+-compute@developer\.gserviceaccount\.com$/;
  const serviceAgent = /^serviceAccount:service-\d+@gcp-sa-[a-z-]+\.iam\.gserviceaccount\.com$/;
  return [projectSa, appEngineSa, computeSa, serviceAgent].some((pattern) => pattern.test(member));
}

export type ProposalValidation = { ok: true; proposal: LlmProposal } | { ok: false; errors: string[] };

export function validateProposal(raw: unknown, facts: IReleaseFacts): ProposalValidation {
  const parsed = llmProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    };
  }

  const proposal = parsed.data;
  const errors: string[] = [];
  const exportNames = new Set(facts.functions.exports.map((entry) => entry.name));
  const eligibleMigrations = new Map(
    facts.migrations.pending.filter((entry) => entry.phase !== null).map((entry) => [entry.script, entry.phase]),
  );

  for (const extra of proposal.extraFunctions) {
    if (!exportNames.has(extra.name)) errors.push(`extraFunctions: "${extra.name}" is not an exported function`);
  }

  for (const grant of proposal.iamGrants) {
    const expectedType = LLM_IAM_ALLOWLIST[grant.role];
    if (grant.resourceType !== expectedType) {
      errors.push(`iamGrants: ${grant.role} must target a ${expectedType}, not a ${grant.resourceType}`);
    }
    if (grant.resourceType === 'function' && !exportNames.has(grant.resource)) {
      errors.push(`iamGrants: function "${grant.resource}" is not an exported function`);
    }
    if (grant.resourceType === 'taskQueue' && !TASK_QUEUE_PATTERN.test(grant.resource)) {
      errors.push(`iamGrants: "${grant.resource}" is not a valid task queue id`);
    }
    if (grant.resourceType === 'pubsubTopic' && !TOPIC_PATTERN.test(grant.resource)) {
      errors.push(`iamGrants: "${grant.resource}" is not a valid Pub/Sub topic id`);
    }
    if (!isAllowedMember(grant.member, grant.role, facts.project)) {
      errors.push(`iamGrants: member "${grant.member}" is not allowed for ${grant.role}`);
    }
  }

  const seen = new Set<string>();
  for (const migration of proposal.migrations) {
    if (!eligibleMigrations.has(migration.script)) {
      errors.push(`migrations: "${migration.script}" is not a pending migration with a @release-phase tag`);
    }
    if (seen.has(migration.script)) errors.push(`migrations: "${migration.script}" listed twice`);
    seen.add(migration.script);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, proposal };
}

function addFunction(map: Map<string, IPlannedFunction>, name: string, source: FunctionSource, reason: string): void {
  const existing = map.get(name) ?? { name, sources: [], reasons: [] };
  if (!existing.sources.includes(source)) existing.sources.push(source);
  existing.reasons.push(reason);
  map.set(name, existing);
}

/**
 * Merge the deterministic floor with an (already validated) proposal.
 * `proposal` is null only in deploy-all mode, which never consults the LLM.
 */
export function mergePlan(facts: IReleaseFacts, proposal: LlmProposal | null, model: string | null): IReleasePlan {
  const deployAll = facts.mode === 'deploy-all';
  const functions = new Map<string, IPlannedFunction>();
  const exportsByName = new Map(facts.functions.exports.map((entry) => [entry.name, entry]));

  if (facts.functions.forceAll.value) {
    for (const entry of facts.functions.exports) {
      addFunction(functions, entry.name, 'all', facts.functions.forceAll.reasons.join('; '));
    }
  }
  for (const hit of facts.functions.graphAffected) {
    for (const reason of hit.reasons) addFunction(functions, hit.name, 'graph', reason);
  }
  for (const entry of facts.functions.exports) {
    if (entry.deployed === false) addFunction(functions, entry.name, 'new', 'not deployed yet');
  }
  for (const extra of proposal?.extraFunctions ?? []) {
    addFunction(functions, extra.name, 'llm', extra.reason);
  }
  const plannedFunctions = [...functions.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Deterministic: every new callable / HTTPS function needs the public Cloud Run invoker,
  // otherwise Cloud Run rejects all requests (see FIREBASE_FUNCTIONS_V2_IAM_FIX.md).
  const iamGrants: IPlannedIamGrant[] = [];
  for (const planned of plannedFunctions) {
    const entry = exportsByName.get(planned.name);
    if (entry && entry.deployed === false && PUBLIC_INVOKER_TRIGGERS.has(entry.trigger)) {
      iamGrants.push({
        role: 'roles/run.invoker',
        resourceType: 'function',
        resource: entry.name,
        member: 'allUsers',
        source: 'deterministic',
        reason: `new ${entry.trigger} function`,
      });
    }
  }
  for (const grant of proposal?.iamGrants ?? []) {
    const duplicate = iamGrants.some(
      (existing) =>
        existing.role === grant.role &&
        existing.resource === grant.resource &&
        existing.member === grant.member &&
        existing.resourceType === grant.resourceType,
    );
    if (!duplicate) iamGrants.push({ ...grant, source: 'llm' });
  }

  const phaseOf = new Map(facts.migrations.pending.map((entry) => [entry.script, entry.phase]));
  const selected: IPlannedMigration[] = [];
  if (deployAll) {
    for (const entry of facts.migrations.pending) {
      if (entry.phase) selected.push({ script: entry.script, phase: entry.phase, reason: 'deploy_all: pending and tagged' });
    }
  } else {
    for (const migration of proposal?.migrations ?? []) {
      const phase = phaseOf.get(migration.script);
      if (phase) selected.push({ script: migration.script, phase, reason: migration.reason });
    }
  }
  selected.sort((a, b) => a.phase.localeCompare(b.phase) || a.script.localeCompare(b.script));

  const manualActions: string[] = [];
  for (const name of facts.functions.deletedFunctions) {
    manualActions.push(`Function \`${name}\` is deployed but no longer exported — delete it manually if intended.`);
  }
  for (const entry of facts.migrations.pending) {
    if (entry.phase === null) {
      manualActions.push(`Migration \`${entry.script}\` has no @release-phase tag — it will not run automatically.`);
    }
  }

  const warnings = [...(proposal?.warnings ?? [])];
  if (facts.rules.firestoreIndexes) {
    warnings.push('Firestore indexes deploy without waiting for builds; queries that need a new index fail with FAILED_PRECONDITION until it is READY.');
  }
  if (!facts.online) {
    warnings.push('Offline preview: deployed functions, secrets and the Migration ledger were not read; new-function IAM and pending migrations may be incomplete.');
  }
  if (facts.diff.omittedFiles.length > 0 && proposal) {
    warnings.push(`The LLM did not see diffs for ${facts.diff.omittedFiles.length} file(s) (lockfiles, binaries or over budget).`);
  }

  const blockers: string[] = [];
  const plannedSecrets = new Set(
    plannedFunctions.flatMap((planned) => exportsByName.get(planned.name)?.secrets ?? []),
  );
  const missing = facts.functions.missingSecrets.filter((name) => plannedSecrets.has(name));
  if (missing.length > 0) {
    blockers.push(`Secret Manager is missing ${missing.map((name) => `\`${name}\``).join(', ')} used by functions in this release.`);
  }
  if (facts.migrations.ledgerSeeded === false) {
    blockers.push('The Migration ledger is not seeded. Run `tsx scripts/release/seed-migration-ledger.ts --write` once.');
  }

  return {
    version: 1,
    project: facts.project,
    base: facts.base,
    head: facts.head,
    mode: facts.mode,
    planner: proposal ? 'llm' : 'none',
    model: proposal ? model : null,
    web: facts.web,
    rules: facts.rules,
    functions: plannedFunctions,
    iamGrants,
    migrations: selected,
    manualActions,
    warnings,
    blockers,
    llmSummary: proposal?.summary ?? null,
  };
}
