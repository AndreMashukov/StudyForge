import { z } from 'zod';
import { documentBlockText, type IDocumentBlock } from './document-blocks';
import {
  SPOKEN_CODE_MAX_CHARS,
  isDataCodeLanguage,
  speakCodeBlock,
  speakInlineCode,
  speakOpaqueStrings,
  spokenCodeLanguage,
} from './narration-speech';

/**
 * Document narration (ADR 013): server-generated English audio of a narratable
 * document, stored as narration parts and played on mobile.
 *
 * - The narratable check result lives on the document record (`narratability`).
 * - The narration lives at `users/{uid}/narrations/{documentId}`; its part audio
 *   at `users/{uid}/narrations/{documentId}/{partKey}.mp3` in Storage.
 * Both are written only by Functions.
 */

/**
 * Bump when block parsing or part cutting changes: block indexes or part
 * boundaries move. It is in every part key and narratable judgement, so a bump
 * regenerates every narration. A change to what is spoken is a new
 * `NARRATION_SCRIPT_VERSION` instead.
 */
export const NARRATION_SCHEMA_VERSION = 1;

/**
 * Spoken-text rules (ADR 020). 1: code blocks are a "Code example." marker and
 * text is sent as written. 2: short code blocks are spoken code, and opaque
 * strings become short phrases. A narration keeps the version it was made
 * with; the version-1 path must not change.
 */
export const NARRATION_SCRIPT_VERSIONS = [1, 2] as const;
export type NarrationScriptVersion = (typeof NARRATION_SCRIPT_VERSIONS)[number];
export const NARRATION_SCRIPT_VERSION: NarrationScriptVersion = 2;

function isNarrationScriptVersion(
  value: number,
): value is NarrationScriptVersion {
  return NARRATION_SCRIPT_VERSIONS.some((version) => version === value);
}

/**
 * The spoken-text rules a document is narrated with: its narration's, or the
 * current rules when it has none. A narration from before versions were
 * stored is version 1.
 */
export function narrationScriptVersionFor(
  record: { scriptVersion?: number } | null | undefined,
): NarrationScriptVersion {
  if (!record) return NARRATION_SCRIPT_VERSION;
  if (record.scriptVersion === undefined) return 1;
  return isNarrationScriptVersion(record.scriptVersion)
    ? record.scriptVersion
    : NARRATION_SCRIPT_VERSION;
}

/** Credits are charged per this many characters of spoken text, rounded up. */
export const NARRATION_CHARS_PER_CREDIT_UNIT = 1_000;

/** A part closes once it reaches this length, at the next block boundary. */
export const NARRATION_TARGET_PART_CHARS = 2_000;

/** No part is longer than this; longer blocks are cut at sentence ends. */
export const NARRATION_MAX_PART_CHARS = 3_000;

/** Documents with more spoken text than this are too long to narrate. */
export const NARRATION_MAX_SPOKEN_CHARS = 60_000;

/** Documents with less speakable prose than this are not narratable. */
export const NARRATABLE_MIN_PROSE_CHARS = 300;

/** Prose must be at least this share of the document's content. */
export const NARRATABLE_MIN_PROSE_RATIO = 0.5;

/** The decision model must say yes with at least this probability. */
export const NARRATABLE_PROBABILITY_THRESHOLD = 0.7;

/** Characters of prose the decision model judges. */
export const NARRATABLE_SAMPLE_CHARS = 4_000;

/** Weight in characters of an image, diagram or embedded item in the prose ratio. */
const NON_TEXT_BLOCK_WEIGHT = 200;

/** Playback rates offered by the player. */
export const NARRATION_PLAYBACK_RATES = [1, 1.25, 1.5] as const;
export type NarrationPlaybackRate = (typeof NARRATION_PLAYBACK_RATES)[number];

/** Stored part audio: MP3, mono, 48 kbps. */
export const NARRATION_AUDIO_BITRATE_KBPS = 48;
export const NARRATION_AUDIO_CONTENT_TYPE = 'audio/mpeg';

/** Rough spoken length at normal rate, used for estimates before audio exists. */
export const NARRATION_CHARS_PER_SECOND = 15;

// ---------------------------------------------------------------------------
// Spoken text
// ---------------------------------------------------------------------------

/** One stretch of spoken text and the block it comes from. */
export interface INarrationSegment {
  /** Index into the document's blocks. */
  blockIndex: number;
  text: string;
  /**
   * `marker` stands in for blocks that are not read, such as a table or long
   * code; `code` is spoken code (script version 2).
   */
  kind: 'prose' | 'code' | 'marker';
  /** A heading of level 1 or 2 starts a new section. */
  sectionStart?: boolean;
}

export interface INarrationProseStats {
  proseChars: number;
  nonProseChars: number;
  /** Prose share of all content, 0 to 1. Zero when the document is empty. */
  proseRatio: number;
}

export interface INarrationScript {
  /** The spoken-text rules it was built with. */
  scriptVersion: NarrationScriptVersion;
  segments: INarrationSegment[];
  stats: INarrationProseStats;
  /** Characters of all segments, markers included. */
  spokenCharCount: number;
}

const PROSE_KINDS = new Set<IDocumentBlock['kind']>([
  'heading',
  'paragraph',
  'quote',
  'list',
]);

function normalizeSpokenText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function blockProseText(block: IDocumentBlock): string {
  return normalizeSpokenText(
    block.spans
      .filter((span) => !span.placeholder)
      .map((span) => span.text)
      .join(''),
  );
}

/** Inline code as words, keeping the whitespace around it so words do not run together. */
function spokenInlineCode(text: string): string {
  const lead = /^\s/.test(text) ? ' ' : '';
  const trail = /\s$/.test(text) ? ' ' : '';
  return `${lead}${speakInlineCode(text)}${trail}`;
}

/** Version 2: inline code is spoken code, the rest has opaque strings replaced. */
function blockSpokenProseText(block: IDocumentBlock): string {
  return normalizeSpokenText(
    block.spans
      .filter((span) => !span.placeholder)
      .map((span) =>
        span.code ? spokenInlineCode(span.text) : speakOpaqueStrings(span.text),
      )
      .join(''),
  );
}

const LONG_CODE_LABEL = 'long code example';

/**
 * Version 2: a code block as spoken code, or the marker label it keeps
 * (data, nothing to say, or longer than `SPOKEN_CODE_MAX_CHARS`).
 */
function spokenCodeBlock(
  block: IDocumentBlock,
): { text: string } | { label: string } {
  if (isDataCodeLanguage(block.language)) return { label: 'code example' };
  const body = speakCodeBlock(documentBlockText(block)).join(' ');
  if (!body) return { label: 'code example' };
  if (body.length > SPOKEN_CODE_MAX_CHARS) return { label: LONG_CODE_LABEL };
  const language = spokenCodeLanguage(block.language);
  const lead = language ? `Code example in ${language}.` : 'Code example.';
  return { text: `${lead} ${body}` };
}

/** Headings and list items end with a full stop so they do not run on. */
function withPause(text: string): string {
  return /[.!?:;…]$/.test(text) ? text : `${text}.`;
}

function markerLabel(block: IDocumentBlock): string {
  if (block.kind === 'code') return 'code example';
  if (block.kind === 'table') return 'table';
  if (block.kind === 'image') {
    const alt = normalizeSpokenText(block.alt ?? '');
    return alt ? `image: ${alt}` : 'image';
  }
  if (block.kind === 'placeholder' && block.placeholderOf === 'diagram') {
    return 'diagram';
  }
  return 'interactive content';
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** Version 2: a marker that includes long code points the listener to the document. */
function markerText(labels: string[], scriptVersion: NarrationScriptVersion) {
  const text = capitalize(joinLabels(labels));
  return scriptVersion >= 2 && labels.includes(LONG_CODE_LABEL)
    ? `${text}, see the document.`
    : withPause(text);
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

/**
 * The words a narration speaks, in document order: the title, then headings,
 * paragraphs, quotes and list items, and (version 2) short code blocks as
 * spoken code. Each run of blocks that cannot be spoken (long code, data,
 * tables, images, diagrams) becomes one short marker.
 *
 * The prose stats are measured on the text as written under every version,
 * so the narratable check does not depend on how code is spoken.
 */
export function buildNarrationScript(
  title: string,
  blocks: IDocumentBlock[],
  scriptVersion: NarrationScriptVersion = NARRATION_SCRIPT_VERSION,
): INarrationScript {
  const speaks = scriptVersion >= 2;
  const segments: INarrationSegment[] = [];
  let proseChars = 0;
  let nonProseChars = 0;
  let pendingLabels: string[] = [];
  let pendingBlockIndex = -1;

  const flushMarker = () => {
    if (pendingLabels.length) {
      segments.push({
        blockIndex: pendingBlockIndex,
        text: markerText(pendingLabels, scriptVersion),
        kind: 'marker',
      });
    }
    pendingLabels = [];
    pendingBlockIndex = -1;
  };

  const spokenTitle = normalizeSpokenText(
    speaks ? speakOpaqueStrings(title) : title,
  );
  if (spokenTitle && blocks.length) {
    segments.push({
      blockIndex: 0,
      text: withPause(spokenTitle),
      kind: 'prose',
    });
  }

  blocks.forEach((block, blockIndex) => {
    if (PROSE_KINDS.has(block.kind)) {
      // Embedded content inside prose is not read, but it weighs against the prose share.
      nonProseChars +=
        block.spans.filter((span) => span.placeholder).length *
        NON_TEXT_BLOCK_WEIGHT;
      const written = blockProseText(block);
      if (!written) return;
      const text = speaks ? blockSpokenProseText(block) : written;
      proseChars += written.length;
      if (!text) return;
      flushMarker();
      const isHeading = block.kind === 'heading';
      segments.push({
        blockIndex,
        text: isHeading || block.kind === 'list' ? withPause(text) : text,
        kind: 'prose',
        sectionStart: isHeading && (block.level ?? 1) <= 2 ? true : undefined,
      });
      return;
    }

    nonProseChars +=
      block.kind === 'code' || block.kind === 'table'
        ? normalizeSpokenText(documentBlockText(block)).length
        : NON_TEXT_BLOCK_WEIGHT;
    if (speaks && block.kind === 'code') {
      const spoken = spokenCodeBlock(block);
      if ('text' in spoken) {
        flushMarker();
        segments.push({ blockIndex, text: spoken.text, kind: 'code' });
        return;
      }
      if (pendingBlockIndex < 0) pendingBlockIndex = blockIndex;
      if (!pendingLabels.includes(spoken.label))
        pendingLabels.push(spoken.label);
      return;
    }
    const label = markerLabel(block);
    if (pendingBlockIndex < 0) pendingBlockIndex = blockIndex;
    if (!pendingLabels.includes(label)) pendingLabels.push(label);
  });
  flushMarker();

  const total = proseChars + nonProseChars;
  return {
    scriptVersion,
    segments,
    stats: {
      proseChars,
      nonProseChars,
      proseRatio: total > 0 ? proseChars / total : 0,
    },
    spokenCharCount: segments.reduce(
      (sum, segment) => sum + segment.text.length,
      0,
    ),
  };
}

export type NarratableScreenOutcome =
  | { outcome: 'judge' }
  | {
      outcome: 'notNarratable';
      reason: 'tooLittleProse' | 'mostlyNonProse' | 'tooLong';
    };

/** The code check that runs before any model is asked. */
export function screenNarrationScript(
  script: INarrationScript,
): NarratableScreenOutcome {
  if (script.stats.proseChars < NARRATABLE_MIN_PROSE_CHARS) {
    return { outcome: 'notNarratable', reason: 'tooLittleProse' };
  }
  if (script.stats.proseRatio < NARRATABLE_MIN_PROSE_RATIO) {
    return { outcome: 'notNarratable', reason: 'mostlyNonProse' };
  }
  if (script.spokenCharCount > NARRATION_MAX_SPOKEN_CHARS) {
    return { outcome: 'notNarratable', reason: 'tooLong' };
  }
  return { outcome: 'judge' };
}

/**
 * Prose the decision model judges: up to `maxChars`, drawn from the start,
 * middle and end so a long document is judged on more than its opening.
 */
export function sampleNarrationProse(
  script: INarrationScript,
  maxChars = NARRATABLE_SAMPLE_CHARS,
): string {
  const prose = script.segments
    .filter((segment) => segment.kind === 'prose')
    .map((segment) => segment.text);
  const full = prose.join('\n\n');
  if (full.length <= maxChars) return full;

  const third = Math.floor(maxChars / 3);
  const middleStart = Math.max(0, Math.floor(full.length / 2 - third / 2));
  return [
    full.slice(0, third),
    full.slice(middleStart, middleStart + third),
    full.slice(full.length - third),
  ].join('\n\n…\n\n');
}

// ---------------------------------------------------------------------------
// Narration parts
// ---------------------------------------------------------------------------

/** One planned narration part, before any audio exists. */
export interface INarrationPartPlan {
  index: number;
  text: string;
  /** First and last block the part reads (inclusive). */
  blockStart: number;
  blockEnd: number;
  charCount: number;
}

/** Cuts text longer than `maxChars` at sentence ends, then at spaces. */
function splitLongText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) ?? [
    text,
  ];
  const pieces: string[] = [];
  let current = '';
  const pushWords = (sentence: string) => {
    let rest = sentence;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(' ', maxChars);
      const at = cut > maxChars / 2 ? cut : maxChars;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    return rest;
  };
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars) {
      if (current.trim()) pieces.push(current.trim());
      current = pushWords(sentence);
    } else {
      current += sentence;
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

/**
 * Cuts a narration script into parts of about `NARRATION_TARGET_PART_CHARS`,
 * at block boundaries, preferring section headings. Parts never exceed
 * `NARRATION_MAX_PART_CHARS`.
 */
export function planNarrationParts(
  script: INarrationScript,
): INarrationPartPlan[] {
  const parts: INarrationPartPlan[] = [];
  let texts: string[] = [];
  let blockStart = -1;
  let blockEnd = -1;
  let length = 0;

  const flush = () => {
    if (!texts.length) return;
    const text = texts.join('\n\n');
    parts.push({
      index: parts.length,
      text,
      blockStart,
      blockEnd,
      charCount: text.length,
    });
    texts = [];
    blockStart = -1;
    blockEnd = -1;
    length = 0;
  };

  const append = (text: string, blockIndex: number) => {
    if (blockStart < 0) blockStart = blockIndex;
    blockEnd = Math.max(blockEnd, blockIndex);
    texts.push(text);
    length += text.length + (texts.length > 1 ? 2 : 0);
  };

  for (const segment of script.segments) {
    for (const piece of splitLongText(segment.text, NARRATION_MAX_PART_CHARS)) {
      const wouldBe = length + piece.length + (texts.length ? 2 : 0);
      const startsSection =
        segment.sectionStart === true &&
        length >= NARRATION_TARGET_PART_CHARS / 2;
      if (
        texts.length &&
        (wouldBe > NARRATION_MAX_PART_CHARS ||
          length >= NARRATION_TARGET_PART_CHARS ||
          startsSection)
      ) {
        flush();
      }
      append(piece, segment.blockIndex);
    }
  }
  flush();
  return parts;
}

/** Credits for generating the given characters of spoken text. */
export function narrationCreditUnits(charCount: number): number {
  if (!Number.isFinite(charCount) || charCount <= 0) return 0;
  return Math.ceil(charCount / NARRATION_CHARS_PER_CREDIT_UNIT);
}

// ---------------------------------------------------------------------------
// Stored records
// ---------------------------------------------------------------------------

export const narratabilityReasonSchema = z.enum([
  'tooLittleProse',
  'mostlyNonProse',
  'tooLong',
  'notSuitable',
]);
export type NarratabilityReason = z.output<typeof narratabilityReasonSchema>;

/** Narratable check result, stored on the document record as `narratability`. */
export const documentNarratabilitySchema = z.object({
  status: z.enum(['narratable', 'notNarratable']),
  reason: narratabilityReasonSchema.optional(),
  /** Decision model probability, when a model was asked. */
  probability: z.number().min(0).max(1).optional(),
  spokenCharCount: z.number().int().nonnegative(),
  /** Hash of the spoken text that was judged. */
  contentHash: z.string().min(1),
  schemaVersion: z.number().int(),
  checkedAt: z.string(),
});
export type DocumentNarratability = z.output<
  typeof documentNarratabilitySchema
>;

export const narrationPartStatusSchema = z.enum([
  'pending',
  'generating',
  'ready',
  'failed',
]);
export type NarrationPartStatus = z.output<typeof narrationPartStatusSchema>;

export const narrationPartSchema = z.object({
  index: z.number().int().nonnegative(),
  /** Hash of the part's text, voice and model; names its audio file. */
  key: z.string().min(1),
  blockStart: z.number().int(),
  blockEnd: z.number().int(),
  charCount: z.number().int().nonnegative(),
  status: narrationPartStatusSchema,
  storagePath: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  /** Set when the part could not be generated. */
  errorMessage: z.string().optional(),
});
export type NarrationPart = z.output<typeof narrationPartSchema>;

export const narrationStatusSchema = z.enum([
  'generating',
  'ready',
  'partial',
  'failed',
]);
export type NarrationStatus = z.output<typeof narrationStatusSchema>;

/** `users/{uid}/narrations/{documentId}`. */
export const narrationRecordSchema = z.object({
  documentId: z.string().min(1),
  schemaVersion: z.number().int(),
  /** Spoken-text rules the parts were made with; missing means version 1. */
  scriptVersion: z.number().int().optional(),
  model: z.string(),
  voice: z.string(),
  /** Hash of the spoken text the parts were planned from. */
  contentHash: z.string(),
  status: narrationStatusSchema,
  parts: z.array(narrationPartSchema),
  /** Run currently generating parts; cleared when it finishes. */
  runId: z.string().optional(),
  updatedAt: z.string(),
});
export type NarrationRecord = z.output<typeof narrationRecordSchema>;

/** Status of a whole narration, from its parts. */
export function summarizeNarrationStatus(
  parts: NarrationPart[],
): NarrationStatus {
  if (
    parts.some(
      (part) => part.status === 'pending' || part.status === 'generating',
    )
  ) {
    return 'generating';
  }
  const ready = parts.filter((part) => part.status === 'ready').length;
  if (ready === parts.length && ready > 0) return 'ready';
  return ready > 0 ? 'partial' : 'failed';
}

// ---------------------------------------------------------------------------
// Callables
// ---------------------------------------------------------------------------

const documentIdSchema = z.string().trim().min(1).max(200);

export const documentNarrationRequestSchema = z.object({
  documentId: documentIdSchema,
});
export type DocumentNarrationRequest = z.output<
  typeof documentNarrationRequestSchema
>;

export const evaluateDocumentNarratabilityResponseSchema = z.object({
  success: z.literal(true),
  /** Missing when the check could not be answered; try again later. */
  narratability: documentNarratabilitySchema.optional(),
  /**
   * True when another request is already checking this content: the result
   * arrives on the document record, so this is not a failure.
   */
  pending: z.boolean().optional(),
});
export type EvaluateDocumentNarratabilityResponse = z.output<
  typeof evaluateDocumentNarratabilityResponseSchema
>;

export const narrationUnavailableReasonSchema = z.enum([
  'featureDisabled',
  'unjudged',
  'notNarratable',
  'generating',
  'documentNotReady',
]);
export type NarrationUnavailableReason = z.output<
  typeof narrationUnavailableReasonSchema
>;

export const narrationQuoteSchema = z.object({
  /** False when nothing can be generated now; see `unavailableReason`. */
  available: z.boolean(),
  unavailableReason: narrationUnavailableReasonSchema.optional(),
  totalParts: z.number().int().nonnegative(),
  partsToGenerate: z.number().int().nonnegative(),
  /** Spoken characters of the parts to generate. */
  chargedCharCount: z.number().int().nonnegative(),
  credits: z.number().int().nonnegative(),
  /** True when the whole narration is regenerated because the voice or model changed. */
  voiceChanged: z.boolean(),
});
export type NarrationQuote = z.output<typeof narrationQuoteSchema>;

export const quoteDocumentNarrationResponseSchema = z.object({
  success: z.literal(true),
  quote: narrationQuoteSchema,
});
export type QuoteDocumentNarrationResponse = z.output<
  typeof quoteDocumentNarrationResponseSchema
>;

export const startDocumentNarrationRequestSchema = z.object({
  documentId: documentIdSchema,
  /** The credits the learner was shown; the start is refused if the price changed. */
  expectedCredits: z.number().int().nonnegative(),
});
export type StartDocumentNarrationRequest = z.output<
  typeof startDocumentNarrationRequestSchema
>;

export const startDocumentNarrationResponseSchema = z.object({
  success: z.literal(true),
  status: z.enum(['started', 'alreadyRunning', 'nothingToGenerate']),
  credits: z.number().int().nonnegative(),
});
export type StartDocumentNarrationResponse = z.output<
  typeof startDocumentNarrationResponseSchema
>;

export const removeDocumentNarrationResponseSchema = z.object({
  success: z.literal(true),
  removed: z.boolean(),
});
export type RemoveDocumentNarrationResponse = z.output<
  typeof removeDocumentNarrationResponseSchema
>;

/** Error detail code when the shown price no longer matches. */
export const NARRATION_PRICE_CHANGED_CODE = 'NARRATION_PRICE_CHANGED';
