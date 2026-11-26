# ADR 015: "Always apply" is set per folder, not per prompt

## Status

Superseded in part by [ADR 016](016-folder-default-prompts-cascade.md) (2026-11-26): always apply now carries down to subfolders, attached rules apply by default, and pickers no longer save. The removals in decision 4 and the migration in decision 5 still stand.

## Context

A rule (a "prompt" in product copy, ADR 014) had one global flag, `isDefault`, labelled **Always apply**. When it was on, the rule started ticked in the prompt pickers (Create Artifact, Create Document) of every folder where it showed up. Ticking a rule in any picker turned the flag on, and unticking turned it off, so a choice made in one folder silently changed every other folder.

Generation never read the flag. With no rules picked, the server applies every rule the folder inherits (`inherit-plus-explicit`); with rules picked, only those (`explicit-only`). Mobile one-tap quiz and flashcards use `inherit`. The flag only decided the pickers' preselection.

## Decision

1. **Always apply is per folder.** A rule stores the folders where it always applies in `alwaysApplyDirectoryIds`. A picker preselects a rule only when its own folder is in that list (`alwaysApplyRuleIdsIn` in shared types).
2. **Exact folder only.** A subfolder that inherits the rule is not covered and has its own setting. Unlike attachment, always apply does not cascade.
3. **Where it is set.**
   - In a picker, ticking a rule turns it on for that picker's folder, and unticking turns it off there.
   - The folder's Prompts tab has an "Always apply here" toggle on each attached or inherited rule.
   - The agent can set it only when attaching: `attach_rule_to_directory` and `create_rule_from_blueprint` take `alwaysApply`.
4. **Removed:**
   - the checkbox in the prompt editor and the New/Edit Prompt form;
   - the badge and "always apply only" filter on the Prompts page;
   - `isDefault` in create/update requests and in the agent's `create_rule` / `update_rule`.
5. **Migration.**
   - `scripts/migrations/backfill-rule-always-apply-directories.ts` (pre-functions) sets `alwaysApplyDirectoryIds` to a rule's attached folders (`directoryIds`) for every rule with `isDefault: true`.
   - Subfolders that only inherited the rule lose the preselection.
   - `isDefault` stays in the data for rollback but is no longer read or written.
6. **Stale entries are ignored.** A folder listed where the rule no longer shows up (detached, or the folder was deleted) has no effect. Re-attaching brings the setting back.

## Considered Options

- **Cascade to subfolders, with per-subfolder opt-out.** This would match how attachment works, but a tick made in one folder would again change other folders, which is the complaint. Rejected.
- **Store the setting on the directory** (`alwaysApplyRuleIds`). The pickers already load rules, not folder documents, and deleting a rule would leave ids on many folders. Rejected.
- **Migrate to every folder where the rule shows up, subfolders included.** This would preserve today's preselection exactly, but large trees would get many folder entries that nobody chose. Rejected.

## Consequences

- The same rule can start ticked in one folder and not in a sibling, so learners decide folder by folder.
- Generation behaviour is unchanged.
- The Prompts page no longer shows which rules always apply. The folder's Prompts tab is where to look.
