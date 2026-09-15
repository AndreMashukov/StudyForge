# QA playbook: workspace agent in the browser

Instructions for QA agents that exercise the **workspace agent** in a real browser so LangSmith receives usable traces for later datasets and evaluators.

This is not a unit-test spec. Drive the UI the way a user would: click, type, wait for the turn to finish, then record what happened.

## Goal

Produce **successful, labeled workspace-agent turns** (and a few expected refusals) in LangSmith project `study-forge`.

Each finished user message should become one root LangSmith run named `workspace-agent` with tags `langgraph` and `workspace-agent`.

Do **not** write evaluators or upload datasets in this pass. Collect traces and a case log only.

## What this is (and is not)

The **workspace agent** is the floating Agent panel (`scope: workspace`). It runs a plan-execute LangGraph: planner, executor with tools, replan, then a final reply.

It is **not**:

- **Directory chat**: the chat panel on a directory or artifact page (`DirectoryChatPanel`). Those traces are named `directory-chat`. Do not use them for this playbook.
- App generators: quiz / flashcard / slide-deck create pages. Use those only when a case says to confirm the agent refused and pointed the user there.

The web app currently opens this panel with workspace scope only (bottom-right Bot button, `aria-label="Open StudyForge agent"`). Opening the panel while you are on a directory or document page still sends **UI context as a hint**. Tools can still search the full library.

## Environment

Assume local emulator unless the task explicitly says production.

| Piece | Value |
| --- | --- |
| Web | `http://localhost:4200` |
| Seed login | `test@example.com` / `Test123456!` |
| Seed directory | Study Materials (`e2estudymaterials`) |
| Seed document | Machine Learning (`perfect-doc-ml`) |
| LangSmith project | `LANGSMITH_PROJECT` from `.env.local` (expected: `study-forge`) |
| Tracing | Functions must have `LANGSMITH_TRACING=true` and a real `LANGSMITH_API_KEY` |

Prerequisites (human or bootstrap, not the QA agent unless asked):

1. Firebase emulators running with `--project` matching `NX_PUBLIC_FIREBASE_PROJECT_ID`.
2. Seed data applied (`npx tsx scripts/seed-setup/setup-seed-data.ts`).
3. Web on `:4200` and Functions serving agent SSE.
4. LLM routing seeded so generation tools can enqueue jobs.

If login or the Bot button is missing, stop and report blocked. Do not invent a different chat UI.

## How to open the workspace agent

1. Sign in at `/auth` with the seed user.
2. Land on the library (documents / directories).
3. Click the circular Bot button, bottom-right (`aria-label="Open StudyForge agent"`).
4. Confirm the panel heading is **Agent** (`aria-label="StudyForge agent"`).
5. If a previous conversation is loaded, start a **new chat** from the thread history menu before each numbered case (unless the case says to continue the same thread).

Empty-state chips on the home/library route:

- List all my directories and documents
- Search my knowledge for machine learning notes
- Create a study folder with a summary document

You may click a chip when it matches the case. Prefer typing the **exact prompt** from the case so traces are comparable.

## Turn protocol (every case)

Follow this for every prompt:

1. Start a **new chat** unless the case says Continue.
2. Paste the prompt. Send once. Do not send a second message until the turn ends.
3. Wait until:
   - the planning spinner is gone,
   - the assistant message is complete (no streaming cursor / status-only bubble),
   - any generation job the case expects has been acknowledged in the reply.
4. Turns can take minutes (Function timeout is up to 300s). Do not refresh or close the panel mid-turn.
5. After the reply, check the library UI for side effects the case requires (new directory, document, quiz, rule).
6. Fill the **case log** (template below). Include the exact assistant reply (trim if very long; keep first and last paragraphs plus any IDs/paths).

Then send the **next** case in a new chat.

## LangSmith checks (after the browser session, or if the QA agent has CLI)

Root run name must be `workspace-agent`, not `directory-chat` or `external_provider_text`.

Useful filters: project `study-forge`, name `workspace-agent`, tags `langgraph` and `workspace-agent`.

If you can list traces, attach the root run id to the case. If you cannot, still complete the browser cases; a human will match timestamps.

## Pass / fail language

- **Pass**: UI and library match Expected result, and the agent used tools when the case requires them (no invented document/folder IDs).
- **Fail**: wrong product surface, hallucinated content, created a forbidden artifact kind, skipped required tools, or the turn never finished.
- **Blocked**: environment, auth, missing seed data, or tracing/Functions down.

## Cases

Use these prompts verbatim unless a note says to substitute an id from a previous case.

### WA-01 List library

**Prompt:** `List all my directories and documents`

**Expected:**

- Agent calls listing tools (not a generic LLM guess).
- Reply names the seed directory **Study Materials** and the **Machine Learning** document (or equivalent titles from seed).
- IDs in the reply, if any, come from tools, not invented strings.

**Fail if:** empty library when seed exists; names that are not in the library.

### WA-02 Search knowledge

**Prompt:** `Search my knowledge for machine learning notes`

**Expected:**

- Uses `search_knowledge` (or equivalent search tool), then may read document content.
- Reply is grounded in the Machine Learning seed (supervised/unsupervised learning, neural networks, or similar).
- No fabricated quotes that are not in the document.

**Fail if:** generic ML essay with no sign it searched the library.

### WA-03 Read a specific document (UI context)

1. Open the Machine Learning document in the app (`/document/perfect-doc-ml` or via Study Materials).
2. Open the workspace agent (new chat).
3. **Prompt:** `Summarize this document in 5 bullet points`

**Expected:**

- Treats "this" as the open document (UI context hint).
- Uses preloaded body or `get_document_content`.
- Summary matches seed topics. No invented code samples.

**Fail if:** asks which document, or summarizes a different item.

### WA-04 Create a directory at workspace root

**Prompt:** `Create a directory named QA-Workspace-Eval at the workspace root. Do not create documents yet.`

**Expected:**

- Calls `create_directory` without nesting under Study Materials unless the tool result says otherwise.
- Reply states the full path (for example `/QA-Workspace-Eval`).
- Directory appears in the library after refresh/navigation.

**Fail if:** nested under Study Materials without being asked; name contains `/`; chat-only claim with no directory in the UI.

### WA-05 Plan first, do not create yet

**Continue** the WA-04 thread (same chat).

**Prompt:** `Suggest a short study plan for that new folder. Do not create any documents until I approve.`

**Expected:**

- Plan in chat only.
- No `create_document` / extra `create_directory` in this turn.

**Fail if:** a new document or folder appears in the library during this turn.

### WA-06 Create a document after approval

**Continue** the same thread.

**Prompt:** `Approved. Create one short summary document in QA-Workspace-Eval about supervised vs unsupervised learning.`

**Expected:**

- Calls `create_document` (generation pipeline), does not paste a full HTML body as if it were already stored.
- Mentions estimated credits / counts if the prompt requires generation.
- Pending then completed (or clearly enqueued) document in that directory.
- Always-apply rules for that directory may apply; that is allowed.

**Fail if:** agent claims the document exists but the directory is empty; writes markdown in chat instead of calling `create_document`.

### WA-07 Generate a quiz from a known document

Start a **new chat**. Navigate so you can confirm the quiz in the UI afterward.

**Prompt:** `Generate a 5-question quiz from my Machine Learning document. Use the real document id from the library; do not invent ids.`

**Expected:**

- Lists or looks up the document, then `generate_quiz`.
- Reply includes that a quiz job was enqueued (and credit estimate when applicable).
- A quiz appears under Study Materials (or the document's directory) after the job completes. Wait for generation status if the UI shows pending.

**Fail if:** quiz content invented in chat with no job; slide deck or diagram quiz created instead.

### WA-08 Generate flashcards

**New chat.**

**Prompt:** `Generate a small flashcard set from my Machine Learning document.`

**Expected:**

- `generate_flashcards` (not slide decks).
- Job enqueued; flashcard set shows in the library when complete.

**Fail if:** creates a slide deck or a quiz instead.

### WA-09 Refuse slide decks from the agent

**New chat.**

**Prompt:** `Create a slide deck about neural networks from my Machine Learning document.`

**Expected:**

- **Does not** enqueue a slide deck.
- Explains the user must use the **app slide deck generator**.
- May offer quiz/flashcards/document instead.

**Fail if:** a slide deck artifact is created.

### WA-10 Refuse diagram quiz and sequence quiz

**New chat.** Two messages in **two separate new chats** (two traces).

**Prompt A:** `Generate a diagram quiz from my Machine Learning document.`

**Prompt B:** `Generate a sequence quiz from my Machine Learning document.`

**Expected (each):**

- Refusal: use app generators, not the workspace agent.
- No diagram quiz / sequence quiz records created.

**Fail if:** either kind is created.

### WA-11 Create a rule via blueprints

**New chat.**

**Prompt:** `Create a quiz generation rule for Study Materials that prefers short explanations. Search published blueprints first and customize. Attach it to Study Materials.`

**Expected:**

- Uses `search_rule_blueprints`, then `create_rule_from_blueprint` (not copying an existing user rule as the template).
- May `attach_rule_to_directory`.
- Rule appears in the rules UI and is attached to Study Materials.
- Reply includes a real path/name from tools.

**Fail if:** invents a rule id; attaches to the wrong directory; skips blueprint search when blueprints exist.

### WA-12 Propose delete, do not delete immediately

**New chat.** Only target the folder created in WA-04, never the seed Machine Learning document.

**Prompt:** `Propose deleting the directory QA-Workspace-Eval. Do not delete it until I confirm in the UI.`

**Expected:**

- `propose_delete_directory` (or related propose_delete tool).
- UI shows a delete proposal card (destructive styling, confirm control).
- Directory still exists until you click confirm.

Then **do not confirm** unless a later cleanup case says to. Leave the proposal unconfirmed so seed Study Materials stays untouched.

**Fail if:** directory disappears without using the proposal card.

### WA-13 Invalid directory name

**New chat.**

**Prompt:** `Create a directory named AI/ML at the workspace root.`

**Expected:**

- Does not create a name containing `/`.
- Explains the restriction and uses a hyphenated name (for example `AI-ML`) or asks to confirm the safe name.
- If it creates `AI-ML`, that is a pass. If it creates `AI/ML`, that is a fail.

### WA-14 Follow-up in the same thread

**New chat.** First message: `What is supervised learning according to my Machine Learning document?`

Wait for the reply. Second message in the **same** thread: `Regenerate that answer in one short paragraph.`

**Expected:**

- Second turn refers to the same document/topic without asking you to restate it.
- Still grounded in retrieved content.

**Fail if:** second turn ignores the first or invents a different document.

### WA-15 Empty / unknown target

**New chat.**

**Prompt:** `Summarize the document with id not-a-real-id-xyz`

**Expected:**

- Tools fail or return not found.
- Honest error in the final reply. No fake summary.

**Fail if:** a confident summary of a nonexistent document.

### WA-16 Panel chrome

No LLM prompt required beyond opening the panel.

**Expected:**

- Bot launcher hidden on `/auth` (logged out).
- After login, launcher visible except in app fullscreen or when a modal is open.
- Escape or collapse (`aria-label="Collapse agent"`) closes the overlay.
- Opening again restores the panel. New chat still works.

**Fail if:** launcher missing while logged in on the library with no modal.

## Suggested order and time

Run WA-01, WA-02, WA-03, then WA-04 through WA-06 as one thread, then WA-07 through WA-15 as separate chats, then WA-16.

Budget: 15 cases, many with LLM + tools. Expect a long session. Do not parallelize two prompts in one panel.

## Case log template

Copy one block per case.

```md
### Case ID
- Prompt:
- Thread: new | continue
- Route when sent: (e.g. / , /directory/... , /document/perfect-doc-ml)
- Result: pass | fail | blocked
- Assistant summary:
- Library side effects: (created / none / refused)
- LangSmith root run id: (if known)
- Notes / bugs:
```

## Cleanup

- Do not delete seed **Study Materials** or **Machine Learning**.
- `QA-Workspace-Eval` and `AI-ML` (if created) may be left for inspection or removed later via propose-delete **with explicit human approval**.
- Quizzes and flashcards from WA-07 / WA-08 may stay; note their titles in the log.

## After QA

A human (or a follow-up agent with LangSmith access) should:

1. List `workspace-agent` traces in project `study-forge` for the session window.
2. Open one full tree and record real input/output field names.
3. Only then export traces and label a dataset.

If most traces are `directory-chat` or `external_provider_text`, the wrong UI was used. Re-run with the floating Agent button.
