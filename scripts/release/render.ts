import type { IReleasePlan } from './schema';

export const PLAN_COMMENT_MARKER = '<!-- release-plan -->';

function list(items: string[], empty = '_none_'): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : empty;
}

export function renderPlanMarkdown(plan: IReleasePlan, options: { preview: boolean; runUrl?: string | null }): string {
  const title = options.preview ? 'Release plan (preview)' : 'Release plan';
  const rules = [
    plan.rules.firestoreRules && 'firestore:rules',
    plan.rules.firestoreIndexes && 'firestore:indexes',
    plan.rules.storageRules && 'storage',
  ].filter((value): value is string => typeof value === 'string');

  const functionLines = plan.functions.map(
    (entry) => `\`${entry.name}\` _(${entry.sources.join(', ')})_ — ${entry.reasons[0] ?? ''}${entry.reasons.length > 1 ? ` (+${entry.reasons.length - 1} more)` : ''}`,
  );
  const iamLines = plan.iamGrants.map(
    (grant) => `\`${grant.role}\` on ${grant.resourceType} \`${grant.resource}\` → \`${grant.member}\` _(${grant.source})_ — ${grant.reason}`,
  );
  const migrationLines = plan.migrations.map((entry) => `\`${entry.script}\` [${entry.phase}] — ${entry.reason}`);

  const sections = [
    PLAN_COMMENT_MARKER,
    `### ${title}`,
    `\`${plan.base.slice(0, 7)}..${plan.head.slice(0, 7)}\` · mode \`${plan.mode}\` · planner ${plan.planner === 'llm' ? `\`${plan.model}\`` : '_none (deterministic)_'}`,
  ];
  if (plan.blockers.length > 0) sections.push(`#### ⛔ Blockers — nothing will deploy\n${list(plan.blockers)}`);
  if (plan.llmSummary) sections.push(`> ${plan.llmSummary.replace(/\n/g, '\n> ')}`);
  sections.push(
    `**Web:** ${plan.web.deploy ? `deploy — ${plan.web.reasons.join('; ')}` : 'skip'}`,
    `**Rules / indexes:** ${rules.length > 0 ? rules.map((rule) => `\`${rule}\``).join(', ') : 'skip'}`,
    plan.functions.length > 12
      ? `**Functions (${plan.functions.length}):**\n<details><summary>show all</summary>\n\n${list(functionLines)}\n\n</details>`
      : `**Functions (${plan.functions.length}):**\n${list(functionLines, '_skip_')}`,
    `**IAM grants:**\n${list(iamLines)}`,
    `**Migrations:**\n${list(migrationLines)}`,
  );
  if (plan.manualActions.length > 0) sections.push(`**Manual action needed:**\n${list(plan.manualActions)}`);
  if (plan.warnings.length > 0) sections.push(`**Warnings:**\n${list(plan.warnings)}`);
  if (options.preview) {
    sections.push('_The merge-time plan is recomputed from the last successful release and may differ._');
  }
  if (options.runUrl) sections.push(`[Workflow run](${options.runUrl})`);
  return `${sections.join('\n\n')}\n`;
}
