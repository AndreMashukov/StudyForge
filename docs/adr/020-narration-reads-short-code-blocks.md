# ADR 020: Narration reads short code blocks; spoken-text rules are pinned per narration

## Status

Accepted (2026-11-28). Extends [ADR 013](013-document-narration-server-generated-parts.md). Amended the same day: spoken code counts as prose in the narratable check (decision 5).

## Context

A narration replaced every code block with the marker "Code example.", so a tutorial's snippets were skipped. Inline code in a sentence went the other way: it was sent to the speech model as written, so a UUID, a commit hash or a URL inside backticks was spelled out character by character. The same happened to opaque strings in plain prose.

Code cannot simply be passed to the speech model. Brackets, semicolons and indentation mean nothing to a listener, and opaque strings such as UUIDs, hashes, tokens and keys are noise however they are read.

Part identity and price both follow the spoken text (ADR 013), so any change to what is spoken changes the parts of every narration that contains it.

## Decision

1. **A code block is read as spoken code, cleaned up in code.** The rules are deterministic and the same for every language, and no model is asked. Structural punctuation is dropped. Operators become words ("equals", "not equal to", "and", "plus", "returns"). `a.b` is read as "a dot b". camelCase and snake_case identifiers are split into words. Comments are read as prose, and string literals are read by their contents. Each line ends with a pause. The block starts with "Code example in Python." (just "Code example." without a known language tag), with no closing cue.
2. **Long code and data stay as markers.** A block whose cleaned text exceeds 600 characters, about 40 seconds of audio, becomes "Long code example, see the document." Blocks tagged as data (`json`, `yaml`, `xml`, `csv`, `diff`, `log`, `output` and their aliases) always stay "Code example." The language comes from the fence's `language-xxx` class, read into an optional `IDocumentBlock.language`. An untagged block is read as code.
3. **Opaque strings become short phrases, in all spoken text.** UUIDs become "a UUID", JWTs "a token", hex hashes "a hash", key-like and base64 runs "a key", numbers of 9 or more digits "a long number", and URLs "a link to" their host. Hex needs at least one digit, so ordinary words are spared. Short numbers and version strings are read as written.
4. **Where each rule runs.** Code blocks and inline code get the full rules. Plain prose, the title and image alt text get only the opaque-string pass, because prose punctuation such as `-`, `/` and `%` carries meaning the speech model already handles.
5. **Spoken code counts as prose in the narratable check (version 2).** A code block that is read aloud counts toward prose by its length as written. Long code, data blocks and tables still count against prose. The 0.5 prose ratio is unchanged, so a tutorial whose snippets are read aloud can pass, and a document dominated by long code, data or tables still fails. The decision model still judges a sample of prose only, but its instructions now say that short code is read aloud and longer code is announced, so prose that introduces code counts as followable. Its threshold is lowered from 0.7 to 0.6: the first code tutorial judged this way scored 0.64 on its prose alone.
6. **Spoken-text rules are versioned on their own and pinned per narration.** `NARRATION_SCRIPT_VERSION` is 2 for these rules, and 1 is the earlier rules, kept frozen. A narration record stores the `scriptVersion` it was made with, and a record without one is version 1. Its spoken text, content hash, part plan and the document's narratable judgement are always built with that version. A version-1 narration stays on version 1 until the learner removes it. An edit then regenerates only the edited parts, under version 1. A document with no narration uses the current version.
7. **`NARRATION_SCHEMA_VERSION` is not bumped.** It is in every part key and judgement, so a bump would regenerate and re-charge every narration. It is now only for block parsing and part cutting, where block indexes or part boundaries move.

## Considered Options

- **A model describes each snippet** ("This function retries the request three times"). Listeners would learn more from it. We rejected it because it costs a model call per snippet, and its output is not deterministic, so part keys would churn unless the description were cached by code hash.
- **No length cap.** We rejected it because a long config or generated file is minutes of speech the learner pays for per character and cannot follow by ear.
- **Keeping all code against prose.** This was the first decision. A generated tutorial with plenty of prose (12,000 spoken characters) still failed as `mostlyNonProse`, although its snippets were short enough to be read. We reversed it to match what the listener hears.
- **Lowering the prose ratio.** We rejected it because it would also let documents made mostly of tables through.
- **Letting existing narrations pick up the new rules.** The learner would be charged again for parts of documents they never edited. Making those regenerations free would need a waiver path through the quote and the credit reservation. We rejected both and pin the rules per narration instead.
- **Parsers per language.** We rejected them for their cost. An occasional wrong word from the generic rules is harmless in speech.

## Consequences

- The version-1 path of `buildNarrationScript` stays in the code as long as version-1 narrations exist.
- A document whose spoken text or prose stats change under version 2 gets a new content hash. Without a narration it is re-judged on open, which is unmetered. A version-2 narration whose hash changes this way keeps all its parts, because part keys follow the spoken text alone.
- A narratable check result records the `scriptVersion` it was judged under. The mobile reader judges a not-narratable result from older rules again when it opens the document, because the price lookup that catches stale results only runs for narratable documents. When the spoken text is unchanged, the server only records the new version, and no model is asked.
- A document without code or opaque strings speaks the same text under both versions. Its content hash and parts are unchanged.
- Spoken code makes documents with code slightly longer to narrate and slightly more expensive, and the quote shows that automatically.
- Moving an old narration to the new rules (an "update narration" action) remains possible later, priced like any other regeneration.
