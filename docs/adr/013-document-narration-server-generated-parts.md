# ADR 013: Document narration is server-generated audio, made in parts on first listen

## Status

Accepted (2026-11-20).

## Context

Learners want to listen to their documents in the mobile app: at normal, 1.25× and 1.5× speed, on a loop, and with the phone locked. Only English narration is in scope, and many documents are unsuitable because they are in another language or are mostly code and tables.

The phone's built-in voices can read text for free. A speech model sounds much better, but it costs money per character and produces audio that has to be stored.

## Decision

1. **A narration is audio generated on the server by a speech model**, not on-device speech. It routes like every other generation: a new `speech` LLM modality and a `documentNarration` generation kind, with one voice set by an admin on the generation route. The first adapter is Gemini text-to-speech.
2. **Only a narratable document can be narrated.** The narratable check runs when a document's content becomes ready or changes (a Firestore trigger on documents), and when the mobile reader opens a document that has no judgement yet. Code first rejects documents with too little speakable prose. A decision model (`documentNarratableDecision`, unmetered) then judges a sample of the prose. The result is stored on the document record, and only the server writes it.
3. **Audio is generated on first listen, not when the document is created.** It is then stored and replayed for free.
4. **A narration is stored as parts.** The spoken text is cut at headings and paragraph ends into parts of about 2,000 characters. Each part is one speech request, compressed and stored as its own file, and playback starts when the first part is ready. A part is identified by a hash of its text, voice and model, so an edit regenerates and charges only the parts whose text changed.
5. **Charging follows length.** The price is credits per 1,000 characters of spoken text. Credits are reserved when the learner confirms the shown price, committed for parts that were generated, and returned for parts that failed. Stored audio counts against the learner's storage.
6. **A narration belongs to its document and is not an artifact.** It has no search record and no place in directory listings. It is removed by the learner, with its document, or when the document stops being narratable. The server does this cleanup, because clients delete documents directly (ADR 002).
7. **Speed and loop are playback settings on the device.** One stored narration serves every rate.

## Considered Options

- **On-device speech (`expo-speech`).** It is free, works offline and stores nothing. We rejected it for voice quality, and because the voice would differ between devices and operating systems.
- **Generate the audio when the document is created.** Listening would start instantly. We rejected it because every narratable document would cost a render although most are never played, and credits would be spent without the learner asking.
- **One audio file per narration.** The player would be simpler. We rejected it because the wait before listening grows with document length, and any edit would regenerate and re-charge the whole narration.
- **A flat credit price per narration.** It is easier to explain. We rejected it because provider cost grows with length, so a flat price overcharges short notes or loses money on long documents.
- **Judging with a text model that reads the whole document.** We rejected it because it costs more per document, runs on every edit, and gives no probability to set a threshold on.
- **Running the check over every existing document at release.** We rejected it because it pays for documents nobody opens on mobile and makes the decision model a release dependency. Documents are judged when first opened instead.
- **Treating a narration as an artifact.** We rejected it because it would give a title, a search record and a directory entry to something that cannot exist apart from its document.

## Consequences

- The speech model returns uncompressed audio, so Functions compress each part before storing it (MP3, 48 kbps mono, about 0.36 MB per minute).
- Each generation run is recorded on its own (`narrationRuns/{runId}`, server only), so what it reserved survives the narration being removed. A run is settled exactly once, and a scheduled sweep settles runs whose worker died, so credits and storage are never held for good. A run records each file before uploading it, and settling deletes the ones the narration does not refer to. It is charged at the price fixed when it started.
- Audio that leaves a narration (an edit, a removal, a re-narration) is queued for deletion (`narrationAudioDeletions`, server only) in the same write that drops it. Its storage is given back only once the file is gone, and the sweep retries what failed.
- One narratable check runs at a time for the same content (`narratabilityChecks`, server only). A result is stored only if the document has not changed since it was read.
- Parts are separate speech requests, so tone and pace can differ slightly where they join. Cuts fall on paragraph ends to hide this.
- The narratable check runs for every user, including those on a plan where narration is off, because the locked Listen control needs the flag.
- Changing the voice or model does not touch stored narrations. Part identity includes both, so the next edit to a document regenerates its whole narration in the new voice.
- The server and the mobile reader must split a document into blocks identically, because parts refer to block ranges. The splitter is shared code, and a change to it needs a new narration schema version.
- A usage limits setup already stored in Firestore treats a new generation kind as enabled. A migration switches `documentNarration` off on the Free setup.
- Background playback needs a new native build of the mobile app.
- Web does not play narrations. The stored parts are not tied to mobile, so web can play them later without server changes.
