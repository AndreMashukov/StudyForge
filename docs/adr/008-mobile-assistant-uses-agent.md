# ADR 008: Mobile assistant uses the agent, not directory chat

## Status

Accepted (2026-11-16)

## Context

The web app has two assistants for a directory. **Directory chat** (`sendDirectoryChatMessage`) applies follow-up rules and keeps a conversation summary. The **directory-scoped agent** (`agentMessageStream` with `scope: 'directory'`) runs the same plan-execute graph as the workspace agent, but its tools are limited to one directory tree. The mobile app has a single composer, and it must be able to return document and artifact cards and queue generation ("Quiz me on this").

## Decision

On mobile, the composer always talks to the agent. With the whole library in scope it uses the workspace agent (`scope: 'workspace'`); on a directory, document or artifact page it uses the directory-scoped agent (`scope: 'directory'`). Directory chat is not used on mobile, so there is one thread type, listed with `listAgentThreads`.

## Considered Options

- **Directory chat for directory scope**: rejected. It can't take actions or return referenced items, and it would add a second thread type to list.
- **Directory chat on content pages, agent on home**: rejected. The composer would behave differently depending on the screen.

## Consequences

- Mobile directory conversations don't apply follow-up rules or conversation summaries, so answers may differ from directory chat on the web for the same question.
- Web directory chat threads don't appear on mobile.
- Each mobile turn is an agent loop and is billed as one (`directoryChat` usage kind for directory scope).
