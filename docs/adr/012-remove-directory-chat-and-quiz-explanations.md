# ADR 012: Remove directory chat and quiz explanations; the agents are the only conversation

## Status

Accepted (2026-11-20).

## Context

StudyForge had three conversational surfaces: the **workspace agent**, the **directory-scoped agent**, and **directory chat**. Directory chat was a separate assistant with its own pipeline, transcripts, rules and LLM route. It also powered "Generate Detailed Explanation" on quiz pages, which opened directory chat seeded with the question. Each quiz question also carried a short built-in explanation that was shown after answering. We want one way to talk to StudyForge.

## Decision

1. **Directory chat is removed.** Its web entry points (the directory Chat tab, the document viewer panel and the quiz-page panels) go without a replacement. On web, the floating workspace agent is the only chat.
2. **Quiz, diagram quiz, sequence quiz and match quiz questions have no explanation.** Both the detailed explanation and the built-in one are gone. Generators stop producing it, and clients stop showing it. Flashcards keep their explanation, because it is part of the card's back, not answer feedback.
3. **The directory-scoped agent stays** and gets its own generation kind, `directoryScopedAgent`. It used to share `directoryChat` with directory chat.
4. **`directoryChat` and `quizFollowup` are removed from the generation-kind union.** Past usage and cost records that name them are not rewritten. Readers check kinds with `isGenerationKind`, show unknown ones as "Retired feature", and still count their credits and costs in totals.
5. **The `followup` and `chat` rule applicabilities are retired.** Stored rules keep the values, and nothing applies them. The workspace agent's `create_rule` must be given an explicit applicability.
6. **Explanation-request telemetry is removed**: its callable, event, counters, answer flags and statistics metric.
7. **Stored data:** explanations, retired rule values and telemetry fields stay in Firestore and are ignored. Directory chat transcripts are deleted by a migration, and the `/chat` rules close.
8. **One release:** a `pre-functions` migration copies `directoryChat` routes and usage limits to `directoryScopedAgent`, functions and rules deploy, then a `post-functions` migration deletes chat threads and their messages.

## Considered Options

- **Keep the built-in per-question explanation and remove only the detailed one.** It costs nothing at runtime and mobile shows it. We rejected it so that quizzes give answer feedback only, with no explanation of either kind.
- **Fold the directory-scoped agent into the workspace agent**, which would let `directoryChat` go with no new kind. We rejected it because the agent would no longer stay inside one directory tree when opened from a directory.
- **Keep `directoryChat` and `quizFollowup` as retired members of the union.** That is the safest option for history parsing. We rejected it so that dead kinds don't stay in routing, limits and admin forms. History safety moves to the readers instead.
- **Rewrite usage history to the new kind.** We rejected it because past `directoryChat` usage mixes directory chat with directory-scoped agent turns and nothing tells them apart, and because billing history should not change.
- **Let the 90-day TTL remove chat transcripts.** That needs no migration. We rejected it so that conversations users can no longer see don't linger for up to 90 days.
- **Point `chat` rules at the workspace agent.** That would be a new feature. The agent is governed by **Platform agent knowledge**, not user rules.

## Consequences

- Existing quizzes still hold `explanation` in Firestore. Any new reader of quiz questions must ignore it rather than show it.
- Anything that reads `generationKind` from stored records must narrow it with `isGenerationKind`, never cast it. New kinds still need metadata, and removed ones fall back to "Retired feature".
- Restoring explanations later would mean regenerating quizzes. Stored ones are left in place, but no generator writes them any more.
- Deleted directory chat transcripts cannot be recovered.
- A browser tab still running the old web bundle gets "function not found" from the removed callables until it reloads.
