/**
 * Always apply is per folder (ADR 015): a rule lists the folders where it
 * starts ticked in the prompt pickers (`alwaysApplyDirectoryIds`). Exact
 * folders only; subfolders that inherit the rule are not covered. Generation
 * never reads it; it only decides the pickers' preselection.
 */
export interface IAlwaysApplyRule {
  id: string;
  alwaysApplyDirectoryIds?: readonly string[];
}

/** True when the rule always applies in exactly this folder. */
export function ruleAlwaysAppliesIn(
  rule: IAlwaysApplyRule,
  directoryId: string | null | undefined,
): boolean {
  return Boolean(
    directoryId && rule.alwaysApplyDirectoryIds?.includes(directoryId),
  );
}

/** Ids of the rules (from those shown in a folder) that start ticked there. */
export function alwaysApplyRuleIdsIn(
  rules: readonly IAlwaysApplyRule[],
  directoryId: string | null | undefined,
): string[] {
  return rules
    .filter((rule) => ruleAlwaysAppliesIn(rule, directoryId))
    .map((rule) => rule.id);
}

/** Request to turn always apply on or off for one rule in one folder. */
export interface SetRuleAlwaysApplyRequest {
  ruleId: string;
  directoryId: string;
  alwaysApply: boolean;
}
