import { z } from 'zod';
import { LLM_IAM_ROLES } from './config';

export const MIGRATION_PHASES = ['pre-functions', 'post-functions'] as const;
export type MigrationPhase = (typeof MIGRATION_PHASES)[number];

export const TRIGGER_KINDS = ['callable', 'https', 'event', 'schedule', 'taskQueue', 'unknown'] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

// ---------------------------------------------------------------------------
// Release facts — computed deterministically, input to the LLM and to merge.
// ---------------------------------------------------------------------------

export interface IFunctionExport {
  name: string;
  trigger: TriggerKind;
  eventType: string | null;
  /** Module specifier in functions/src/index.ts, or 'index' for inline exports, or null if unmapped. */
  module: string | null;
  secrets: string[];
  /** null when the deployed list could not be read (offline preview). */
  deployed: boolean | null;
}

export interface IGraphHit {
  name: string;
  reasons: string[];
}

export interface IPendingMigration {
  script: string;
  phase: MigrationPhase | null;
  header: string;
  changedInDiff: boolean;
}

export interface IReleaseFacts {
  project: string;
  base: string;
  head: string;
  mode: 'diff' | 'deploy-all';
  /** false when GCP was not reachable (fork PR / local without credentials). */
  online: boolean;
  changedFiles: string[];
  web: { deploy: boolean; reasons: string[] };
  rules: { firestoreRules: boolean; firestoreIndexes: boolean; storageRules: boolean };
  functions: {
    exports: IFunctionExport[];
    forceAll: { value: boolean; reasons: string[] };
    graphAffected: IGraphHit[];
    /** Changed files in some function's closure whose compiled JS is identical (ignored by the graph). */
    typeOnlyChanges: string[];
    deletedFunctions: string[];
    missingSecrets: string[];
  };
  migrations: {
    ledgerSeeded: boolean | null;
    pending: IPendingMigration[];
  };
  diff: { text: string; truncatedFiles: string[]; omittedFiles: string[] };
}

// ---------------------------------------------------------------------------
// LLM proposal — the only thing the model returns. Validated before use.
// ---------------------------------------------------------------------------

const roleEnum = z.enum(LLM_IAM_ROLES);

export const llmProposalSchema = z
  .object({
    summary: z.string().min(1).max(3000),
    extraFunctions: z
      .array(z.object({ name: z.string().min(1), reason: z.string().min(1).max(500) }).strict())
      .default([]),
    iamGrants: z
      .array(
        z
          .object({
            role: roleEnum,
            resourceType: z.enum(['function', 'taskQueue', 'pubsubTopic']),
            resource: z.string().min(1).max(255),
            member: z.string().min(1).max(255),
            reason: z.string().min(1).max(500),
          })
          .strict(),
      )
      .default([]),
    migrations: z
      .array(z.object({ script: z.string().min(1), reason: z.string().min(1).max(500) }).strict())
      .default([]),
    warnings: z.array(z.string().min(1).max(1000)).default([]),
  })
  .strict();

export type LlmProposal = z.infer<typeof llmProposalSchema>;

// ---------------------------------------------------------------------------
// Release plan — the validated, executable result.
// ---------------------------------------------------------------------------

export type FunctionSource = 'all' | 'graph' | 'new' | 'llm';

export interface IPlannedFunction {
  name: string;
  sources: FunctionSource[];
  reasons: string[];
}

export interface IPlannedIamGrant {
  role: string;
  resourceType: 'function' | 'taskQueue' | 'pubsubTopic';
  resource: string;
  member: string;
  source: 'deterministic' | 'llm';
  reason: string;
}

export interface IPlannedMigration {
  script: string;
  phase: MigrationPhase;
  reason: string;
}

export interface IReleasePlan {
  version: 1;
  project: string;
  base: string;
  head: string;
  mode: 'diff' | 'deploy-all';
  planner: 'llm' | 'none';
  model: string | null;
  web: { deploy: boolean; reasons: string[] };
  rules: { firestoreRules: boolean; firestoreIndexes: boolean; storageRules: boolean };
  functions: IPlannedFunction[];
  iamGrants: IPlannedIamGrant[];
  migrations: IPlannedMigration[];
  /** Things the pipeline will never do itself — a human must. */
  manualActions: string[];
  warnings: string[];
  /** Non-empty blockers fail the release before anything is deployed. */
  blockers: string[];
  llmSummary: string | null;
}
