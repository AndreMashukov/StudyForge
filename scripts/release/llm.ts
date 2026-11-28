/**
 * Release planner call: Together AI's Anthropic-compatible Messages API via @anthropic-ai/sdk.
 * One request with the facts + diff, no tools. The reply must be a JSON proposal that passes
 * validateProposal(); on failure the errors are fed back (up to LLM_MAX_ATTEMPTS). If every try fails, the release fails.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  LLM_BASE_URL,
  LLM_IAM_ALLOWLIST,
  LLM_MAX_ATTEMPTS,
  LLM_MAX_TOKENS,
  LLM_MAX_WARNINGS,
  LLM_MODEL,
  LLM_TIMEOUT_MS,
  WORKSPACE_AGENT_KNOWLEDGE_PATH,
} from './config';
import { validateProposal } from './plan-core';
import type { IReleaseFacts, LlmProposal } from './schema';

const SYSTEM_PROMPT = `You are the release planner for StudyForge, a Firebase app (web on Hosting, Cloud Functions v2 in asia-east1, Firestore).

Code has already decided, deterministically, and you cannot change:
- whether the web app deploys, and whether Firestore rules / indexes / storage rules deploy;
- the floor set of functions to deploy (import-graph hits, new exports, force-all);
- the public run.invoker grant for every new callable/HTTPS function (never propose "allUsers" yourself);
- whether to publish and re-index Platform agent knowledge in Firestore. When workspaceAgentKnowledge.status is "publish", mention the planned publication and re-indexing in the summary.

Your job is only to propose additions, as one JSON object:
{
  "summary": string,            // 1-3 sentences: what ships to users/production and why your picks; no setup steps
  "extraFunctions": [{ "name": string, "reason": string }],
  "iamGrants": [{ "role": string, "resourceType": "function"|"taskQueue"|"pubsubTopic", "resource": string, "member": string, "reason": string }],
  "migrations": [{ "script": string, "reason": string }],
  "warnings": [string]
}

Rules:
- extraFunctions: only exported functions NOT already in the floor whose behaviour changes in ways an import graph cannot see (e.g. a Firestore document shape or path they read changed elsewhere, a Pub/Sub message contract changed by a publisher). Usually empty.
- iamGrants: only when the diff creates a new caller relationship (a function now enqueues to a task queue, publishes to a topic, or invokes another function as a service account). Allowed role → resourceType pairs: ${Object.entries(LLM_IAM_ALLOWLIST)
  .map(([role, type]) => `${role} → ${type}`)
  .join(', ')}. Members: only "serviceAccount:<full email>" where the email is copied exactly from functions.runtimeServiceAccounts. Never write a placeholder or partial member; if you cannot name the exact member, write a warning instead of a grant. A function running as the same runtime service account as an existing caller of the same kind (e.g. another function already enqueues to a task queue) already has the permission at project level — propose nothing. Never propose project-level roles; put those in warnings instead. Usually empty.
- migrations: choose from "eligibleMigrations" only. Pick a script when this release needs it (it was added/changed in this diff, or its header says it backs the code being shipped). Do not pick unrelated scripts. Every pick runs unattended against production with --write.
- A change to the workspace agent knowledge Markdown alone needs only the scheduled publish and re-index step.
- warnings: at most ${LLM_MAX_WARNINGS}, most important first, one sentence each. Only risks specific to deploying THIS diff to production that a human must act on or watch: a new Firestore query that seems to need a composite index missing from firestore.indexes.json, project-level IAM the code now needs, a renamed function (the old one keeps running), a risky data or contract change, a behaviour change users will notice. Empty is normal and preferred when nothing stands out.
  Do NOT warn about: setup or instructions found in docs/READMEs/scripts in the diff (the operator has done it), how this pipeline works, facts already shown in the plan (force-all, file counts, skipped steps, omitted diffs), or generic advice ("monitor the rollout", "review before merging").
- Never invent function names, scripts, or roles. Reply with the JSON object only — no prose, no code fences.`;

function factsForPrompt(facts: IReleaseFacts): string {
  const floor = new Set([
    ...facts.functions.graphAffected.map((hit) => hit.name),
    ...facts.functions.exports.filter((entry) => entry.deployed === false).map((entry) => entry.name),
    ...(facts.functions.forceAll.value ? facts.functions.exports.map((entry) => entry.name) : []),
  ]);
  const payload = {
    range: { base: facts.base, head: facts.head },
    changedFiles: facts.changedFiles,
    web: facts.web,
    rules: facts.rules,
    workspaceAgentKnowledge: { path: WORKSPACE_AGENT_KNOWLEDGE_PATH, ...facts.workspaceAgentKnowledge },
    functions: {
      floor: [...floor].sort(),
      forceAll: facts.functions.forceAll,
      graphAffected: facts.functions.graphAffected,
      typeOnlyChanges: facts.functions.typeOnlyChanges,
      exports: facts.functions.exports.map((entry) => ({
        name: entry.name,
        trigger: entry.trigger,
        eventType: entry.eventType,
        module: entry.module,
        deployed: entry.deployed,
      })),
      deletedFunctions: facts.functions.deletedFunctions,
      runtimeServiceAccounts: facts.functions.runtimeServiceAccounts,
    },
    eligibleMigrations: facts.migrations.pending
      .filter((entry) => entry.phase !== null)
      .map((entry) => ({ script: entry.script, phase: entry.phase, changedInDiff: entry.changedInDiff, header: entry.header })),
    diffNotes: { truncatedFiles: facts.diff.truncatedFiles, omittedFiles: facts.diff.omittedFiles },
  };
  return `<facts>\n${JSON.stringify(payload, null, 2)}\n</facts>\n\n<diff>\n${facts.diff.text}\n</diff>`;
}

/** Pull a JSON object out of a model reply (tolerates think tags and code fences). */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```(?:json)?/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Reply contains no JSON object');
  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
  return parsed;
}

function replyText(message: Anthropic.Message): string {
  return message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n');
}

export interface IPlannerResult {
  proposal: LlmProposal;
  model: string;
  attempts: number;
}

export async function proposeWithLlm(facts: IReleaseFacts, apiKey: string): Promise<IPlannerResult> {
  const client = new Anthropic({
    baseURL: LLM_BASE_URL,
    apiKey: null,
    authToken: apiKey,
    timeout: LLM_TIMEOUT_MS,
    maxRetries: 0,
  });

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: factsForPrompt(facts) }];
  const failures: string[] = [];

  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt += 1) {
    let text: string;
    let stopReason: string | null;
    try {
      const message = await client.messages.create({
        model: LLM_MODEL,
        max_tokens: LLM_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
      });
      text = replyText(message);
      stopReason = message.stop_reason;
    } catch (error) {
      failures.push(`attempt ${attempt}: request failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    let validationErrors: string[];
    try {
      const result = validateProposal(extractJson(text), facts);
      if (result.ok) return { proposal: result.proposal, model: LLM_MODEL, attempts: attempt };
      validationErrors = result.errors;
    } catch (error) {
      // Say why there was nothing to parse — a reply cut off at max_tokens reads the same as prose otherwise.
      const detail = `stop_reason=${stopReason ?? 'unknown'}, ${text.length} chars`;
      validationErrors = [`${error instanceof Error ? error.message : String(error)} (${detail})`];
    }

    failures.push(`attempt ${attempt}: invalid plan: ${validationErrors.join('; ')}`);
    messages.push(
      { role: 'assistant', content: text || '(empty reply)' },
      {
        role: 'user',
        content: `Your reply was rejected:\n- ${validationErrors.join('\n- ')}\nReply again with the corrected JSON object only.`,
      },
    );
  }

  throw new Error(`Release planner LLM failed — release aborted.\n${failures.join('\n')}`);
}
