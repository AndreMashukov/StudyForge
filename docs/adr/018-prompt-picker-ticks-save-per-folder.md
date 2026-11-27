# ADR 018: Ticks in a prompt picker save, for that folder only

## Status

Accepted (2026-11-27). Replaces decisions 2 and 3 of [ADR 016](016-folder-default-prompts-cascade.md).

## Context

ADR 016 made the prompt pickers one-off. Unticking a prompt changed only the thing being created, and a separate "Save as default" button stored the choice. A stored "off" also carried down to the folder's subfolders.

In practice, unticking a prompt in a create dialog (for example a slide deck style) means "I don't want this here". Learners expected the dialog to reopen the way they left it. They did not expect a second step, or a change in folders they were not looking at.

## Decision

1. **Every tick saves.**
   - Ticking or unticking a prompt in a picker stores it at once as the folder's default.
   - It is stored even when the dialog is closed without creating anything.
   - This applies to every picker: the create-artifact dialogs and Create Document.
2. **The picker has no "Save as default", Reset or "Default" badge.** With every tick saved, they would do nothing. A hint under the list says the choice is remembered for the folder.
3. **Off applies to that folder only.**
   - The rule stores the folders that switched it off, in `alwaysApplyOffDirectoryIds`.
   - A rule attached to a folder or an ancestor applies by default unless the folder itself is on that list (`ruleAppliesByDefault` in shared types).
   - Subfolders, parents and siblings are never changed by a tick.
   - `alwaysApplyDirectoryIds` (the "on" list from ADR 015 and 016) is no longer read or written.
4. **One switch per prompt and folder.** A prompt that applies to several types (for example quizzes and flashcards) is on or off for all of them in that folder. This matches the single toggle on the folder's Prompts tab.
5. **The rest of ADR 016 stands.**
   - Attaching a rule applies it by default in the folder and its subfolders.
   - Generation without a picker (mobile one-tap, the Workspace agent, photo and scan captures) applies the folder's defaults.
   - The Prompts tab toggle and the agent's `alwaysApply: false` follow the per-folder rule.

## Considered Options

- **Keep one-off ticks with a clearer "Save as default" button.** This still needs two steps for the common case. Rejected.
- **Save only unticks.** A prompt switched off by accident could be switched back on only from the Prompts tab. Rejected.
- **Save when Create is pressed.** Closing the dialog would lose the choice, and the stored default would depend on which dialog was submitted. Rejected.
- **Keep the cascade to subfolders.** One untick in a dialog would change many folders the learner is not looking at. Rejected.
- **A switch per artifact type.** This needs new stored data and one toggle per type on the Prompts tab. Rejected.

## Consequences

- A picker reopens the way it was left in that folder.
- A prompt already switched off in a folder under ADR 016 becomes on again in that folder's subfolders, which never chose it themselves. No migration is done.
- Switching a prompt off in a dialog also stops it for the mobile app and the agent in that folder.
- A prompt shown in both pickers of one dialog (generation and description) shows the new state in the other picker only after the dialog is reopened.
