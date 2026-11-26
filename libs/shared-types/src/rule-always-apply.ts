/**
 * Always apply (ADR 016): which of the rules shown in a folder apply there by
 * default. A rule attached to a folder (or an ancestor) applies by default in
 * that folder and its subfolders. Any folder can switch a rule off or back on;
 * that choice carries down to its own subfolders until one of them makes a
 * different choice.
 *
 * Stored on the rule as two lists of folders with an explicit choice:
 * `alwaysApplyDirectoryIds` (switched on) and `alwaysApplyOffDirectoryIds`
 * (switched off). A folder in neither list follows its parent; with no choice
 * anywhere up the tree the rule applies.
 *
 * The defaults preselect the prompt pickers and are what generation applies
 * when the request picks no rules itself (`inherit` modes).
 */
export interface IAlwaysApplyRule {
  id: string;
  alwaysApplyDirectoryIds?: readonly string[];
  alwaysApplyOffDirectoryIds?: readonly string[];
}

/**
 * True when the rule applies by default in a folder. `directoryChain` is the
 * folder's own id first, then its parent, up to the root folder.
 */
export function ruleAppliesByDefault(
  rule: IAlwaysApplyRule,
  directoryChain: readonly string[],
): boolean {
  for (const directoryId of directoryChain) {
    if (rule.alwaysApplyOffDirectoryIds?.includes(directoryId)) {
      return false;
    }
    if (rule.alwaysApplyDirectoryIds?.includes(directoryId)) {
      return true;
    }
  }
  return true;
}

/** Ids of the rules (from those shown in a folder) that apply there by default. */
export function defaultRuleIdsIn(
  rules: readonly IAlwaysApplyRule[],
  directoryChain: readonly string[],
): string[] {
  return rules
    .filter((rule) => ruleAppliesByDefault(rule, directoryChain))
    .map((rule) => rule.id);
}

export interface IAlwaysApplyChange {
  /** Folder ids to add to / remove from `alwaysApplyDirectoryIds`. */
  on: 'add' | 'remove';
  /** Folder ids to add to / remove from `alwaysApplyOffDirectoryIds`. */
  off: 'add' | 'remove';
}

/**
 * What to store when a folder switches a rule on or off. When the wanted state
 * is what the folder would get from its parents anyway, its own choice is
 * cleared so it keeps following them; otherwise the choice is stored.
 */
export function planAlwaysApplyChange(
  rule: IAlwaysApplyRule,
  directoryChain: readonly string[],
  alwaysApply: boolean,
): IAlwaysApplyChange {
  const inherited = ruleAppliesByDefault(rule, directoryChain.slice(1));
  if (inherited === alwaysApply) {
    return { on: 'remove', off: 'remove' };
  }
  return alwaysApply
    ? { on: 'add', off: 'remove' }
    : { on: 'remove', off: 'add' };
}

/** Request to switch one rule on or off by default in one folder. */
export interface SetRuleAlwaysApplyRequest {
  ruleId: string;
  directoryId: string;
  alwaysApply: boolean;
}
