/**
 * Always apply (ADR 016, ADR 018): which of the rules shown in a folder apply
 * there by default. A rule attached to a folder (or an ancestor) applies by
 * default in that folder and its subfolders, unless the folder itself
 * switched it off. Switching off affects that one folder only: subfolders,
 * parents and siblings keep their own state.
 *
 * Stored on the rule as `alwaysApplyOffDirectoryIds`, the folders that
 * switched it off. `alwaysApplyDirectoryIds` (ADR 015 and 016) is no longer
 * read or written.
 *
 * The defaults preselect the prompt pickers and are what generation applies
 * when the request picks no rules itself (`inherit` modes).
 */
export interface IAlwaysApplyRule {
  id: string;
  alwaysApplyOffDirectoryIds?: readonly string[];
}

/** True when the rule applies by default in the folder. */
export function ruleAppliesByDefault(
  rule: IAlwaysApplyRule,
  directoryId: string,
): boolean {
  return !rule.alwaysApplyOffDirectoryIds?.includes(directoryId);
}

/** Ids of the rules (from those shown in a folder) that apply there by default. */
export function defaultRuleIdsIn(
  rules: readonly IAlwaysApplyRule[],
  directoryId: string,
): string[] {
  return rules
    .filter((rule) => ruleAppliesByDefault(rule, directoryId))
    .map((rule) => rule.id);
}

/** Request to switch one rule on or off by default in one folder. */
export interface SetRuleAlwaysApplyRequest {
  ruleId: string;
  directoryId: string;
  alwaysApply: boolean;
}
