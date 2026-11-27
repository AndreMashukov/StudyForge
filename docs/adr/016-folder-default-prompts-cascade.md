# ADR 016: A folder's default prompts cascade, and pickers are one-off

## Status

Accepted (2026-11-26). Replaces decisions 1 to 3 and 6 of [ADR 015](015-always-apply-per-folder.md).

Superseded in part by [ADR 018](018-prompt-picker-ticks-save-per-folder.md) (2026-11-27): every tick in a picker saves, there is no "Save as default", and switching a rule off affects that folder only (decisions 2 and 3).

## Context

ADR 015 made "Always apply" a setting for one exact folder and kept the older habit of saving it whenever a rule (a "prompt" in product copy, ADR 014) was ticked or unticked in a picker. Four expectations did not fit:

1. A rule attached to a folder should apply there and in its subfolders until the learner switches it off.
2. Trying different rules for one artifact should not change anything for the next one.
3. A learner who likes a rule for a folder should be able to keep it applied there.
4. Things generated without a picker (the mobile app's one-tap quiz and flashcards, documents the workspace agent creates) should follow the folder.

Generation also ignored the setting: the `inherit` modes applied every attached or inherited rule, ticked or not.

## Decision

1. **Attached means applied by default.** A rule attached to a folder, or to one of its ancestors, applies by default in that folder.
2. **A folder can switch a rule off or back on, and that carries down.**
   - A subfolder follows its parent until it makes its own choice.
   - The rule stores the folders that chose: `alwaysApplyDirectoryIds` (on) and `alwaysApplyOffDirectoryIds` (off).
   - The nearest choice walking up from the folder wins; with no choice anywhere the rule applies (`ruleAppliesByDefault` in shared types).
   - Switching a rule to what the folder would get from its parents anyway clears the folder's own choice, so it follows them again.
   - Attaching stores "on" for that folder. Detaching clears the folder's choice.
3. **Pickers are one-off.**
   - A picker opens with the folder's default rules ticked.
   - Ticking and unticking changes only the thing being created and stores nothing.
   - "Save as default" in the picker stores the current choice for the folder.
   - The folder's Prompts tab has an on/off toggle per rule.
4. **Generation uses the defaults.**
   - `inherit` and `inherit-plus-explicit` apply the folder's default rules, not every attached rule.
   - `explicit-only` is unchanged, so the web pickers still apply exactly what is ticked.
5. **Captures are not rewritten.**
   - Pasted text, links and files stay `explicit-only` with no rules, as before.
   - Photo and scan captures keep using the folder's rules for AI documents, now limited to the defaults.
6. **No data migration.**
   - "On" entries written by ADR 015's migration keep their meaning.
   - A rule that was attached but not always-apply now applies by default, because no folder has switched it off.

## Considered Options

- **Keep exact-folder always apply (ADR 015).** A rule attached to a parent then starts unticked in every subfolder, against expectation 1. Rejected.
- **Keep saving on every tick.** Experimenting in a picker would keep rewriting the folder's defaults, against expectation 2. Rejected.
- **Treat "attached but never ticked" as off, by migration.** This would keep the web pickers exactly as they were, but the mobile app and the agent would silently stop applying rules they apply today, including the starter course's. Rejected.
- **Apply rules to pasted text, links and files** when a rule opts in through its applicability. Rejected: captures should stay faithful to their source.
- **Offer unattached rules in the picker.** Rejected: attaching a rule to the folder already does this.

## Consequences

- One tick in a picker never changes another creation.
- Switching a rule off in a folder also stops it for the mobile app and the agent there, not only in the web pickers.
- Rules that were attached but unticked on web start ticked after this change. Learners who want them off switch them off once in the folder's Prompts tab.
- A folder with its own stored choice does not follow a later change in its parent.
