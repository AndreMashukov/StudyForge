# ADR 017: Agent prompts are rules, and suggested ones run from the live blueprint

## Status

Accepted (2026-11-26).

## Context

Learners want to save a request for the workspace agent and run it again later. For example: "recap the quizzes I took today, with a poem and a diagram for each section". They want to run it by typing "/" in the agent composer, as in VS Code or Cursor, and to create one by asking the agent to save the current request.

Two things are new here:

- **Not tied to a folder.** Rules (called "prompts" in product copy, ADR 014) attach to folders and steer one operation. These saved requests are global.
- **Saved by the agent.** The agent creates one from the conversation.

Admins also want to publish ready-made ones, such as "Yesterday activity recap doc", that every learner can use from day one.

## Decision

1. **An agent prompt is a rule with the `agent` applicability.**
   - No new collection, entity or editor. The Prompts page, the rule editor, the agent's `create_rule` / `update_rule` tools and rule blueprints all carry it.
   - `agent` is exclusive: a rule that applies to `agent` applies to nothing else. Agent prompts are global: they never attach to folders, so always apply (ADR 016) does not concern them.
   - Content is limited to 10,000 characters, because the text is sent to the planner on every run.
   - These checks live in shared types (`validateAgentPromptRule`, `agentPromptAttachError`). They run on the server (rule CRUD, blueprints, agent tools) and in the web app, which writes rules to Firestore directly.
   - A rule attached to folders cannot become an agent prompt until it is detached.
2. **Running one sends a reference, not the text.**
   - The composer sends `agentPrompt: { source, id }` and the optional extra text typed after the chip as `message`.
   - The server loads the current text, frames it in the bracket style already used for UI context as the learner's own saved request (the system prompt says it does not change the agent's rules or safeguards), and freezes it into the turn request. XML-like tags around the text made the planner model fall back to its native tool-call format, so they are not used.
   - The user message stores `agentPrompt` with the name and text as they were at run time. The chat shows only "/Name — extra", and the agent's history of later turns still contains the full request.
   - A prompt deleted since it was picked fails the start with `AGENT_PROMPT_NOT_FOUND`.
   - A run costs and is guarded exactly like the same text typed by hand.
3. **Suggested agent prompts are published agent blueprints, run directly.**
   - The "/" menu lists the learner's own agent prompts, then published blueprints with the `agent` applicability (`listSuggestedAgentPrompts` callable).
   - Running a suggested one loads the blueprint's currently published text, so an admin edit changes it for everyone on their next run.
   - "Save a copy" makes an editable rule with `sourceBlueprintId`; the menu then hides the suggested row for that learner in favour of the copy.
   - The menu has no built-in commands.
4. **Saving from a chat is the agent's job.** The system prompt tells the agent to call `create_rule` with `["agent"]` when asked to save the current request. It writes a reusable version (relative dates stay relative, one-off details are dropped, later refinements are folded in) and saves without a confirmation step.

## Alternatives considered

- **A separate "Skill" entity** with its own storage and page. Cleaner in theory, but it means a second create/edit/delete path on web, mobile and the agent, for a thing that is still markdown text with a name.
- **Copy-only blueprints**, which must be copied before they appear in the menu. Simpler, but a new account would see an empty menu, and admin fixes would never reach existing copies.
- **Sending the prompt text from the client.** Simpler, but old chats would hold a stale copy with no link to the rule, and the client could send arbitrary "saved" text.

## Consequences

- Every `Record<RuleApplicability, …>` needed an `agent` entry. Folder lists (attach dialogs) filter agent prompts out, and generation never sees them, because resolution filters by operation.
- The web app enforces the rules client-side, as it does for all rule writes; Firestore security rules do not.
- The mobile app can run agent prompts but not create, edit or copy them (all prompt management stays web-only).
- Suggested prompts are one callable away. The list is read when the "/" menu first opens and cached.
