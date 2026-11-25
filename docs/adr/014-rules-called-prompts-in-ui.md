# ADR 014: Rules are called "prompts" in learner-facing copy only

## Status

Accepted (2026-11-25).

## Context

Learners find the word "rules" stiff. It reads like a restriction, not like the saved instructions it really is: text that steers how StudyForge writes documents, quizzes and flashcards. We want learners to see "prompts" instead.

"Rule" is used throughout the system: shared types (`Rule`, `RuleApplicability`), the Firestore `rules` collection, callables and endpoints, URLs (`/rules`, `/rules/editor/:ruleId`, the directory `rules` tab), the workspace agent's tool names (`create_rule`, `attach_rule_to_directory`, …), the External API, and the admin app's **rule blueprints**.

"Prompt" already means something else in places: the **AI Prompt** Create Document source (`documentFromPrompt`), the `prompt` rule applicability, and LLM prompts in general.

## Decision

1. **Learner-facing copy says "prompt".** This covers every label, heading, empty state, tooltip, toast and aria label on web, and mobile copy too. Backend error messages that reach learners through callables (`functions/src/endpoints/rules.ts`, `rule-ai.ts`, `libs/backend/directories/src/rule-crud.ts`) also say "prompt".
2. **The workspace agent says "prompt" in replies.** One line in its system prompt tells it to do so, and to read "prompt" from the learner as a rule. Its fallback replies and action summaries say "prompt" too. Tool names, arguments and IDs keep "rule".
3. **Everything else keeps "rule".** That means code, types, Firestore, URLs, agent tool names, the External API, and the admin app (rule blueprints are an internal tool).
4. **Clashes are renamed away from "prompt".** The `prompt` applicability is labelled **AI Document**. The Create Artifact free-text field is **Additional instructions** (its validation errors no longer say "Additional prompt"). The **AI Prompt** document source keeps its name.

## Considered Options

- **Rename end to end** (types, collection, URLs, tools). It would be consistent, but it would need a Firestore migration, redirects, External API versioning and a coordinated mobile release, all for a wording change. Rejected.
- **Move URLs to `/prompts` with redirects from `/rules`.** It would be consistent in the address bar, but it means two route sets to maintain and links to change in mobile and the agent. Rejected for now. It can be done later without touching data.
- **Rename the AI Prompt source** (for example to "Generate with AI") to avoid the clash. Rejected because learners know that feature by name, and "Prompts apply to AI Prompt documents" still reads clearly.

## Consequences

- Developers will read `Rule` in code for what learners call a prompt. **CONTEXT.md** records this under **Rule** and in the flagged ambiguities. Do not "fix" the mismatch by renaming code without revisiting this ADR.
- New learner-facing copy about rules must say "prompt". New code keeps `rule` naming.
- The address bar still shows `/rules`.
- The External API and admin app still say "rule". Support conversations may need to map the two words.
