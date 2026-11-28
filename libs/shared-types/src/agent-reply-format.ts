import { z } from 'zod';

/**
 * Rich Workspace agent replies: tables, Mermaid diagrams, LaTeX formulas and
 * Plotly plots in the reply markdown.
 *
 * The planner returns its reply inside a JSON string, so a LaTeX backslash the
 * model forgot to double is read as a JSON escape: `\frac` arrives as a form
 * feed plus "rac", `\theta` as a tab plus "heta". `normalizeAgentReplyMarkdown`
 * repairs that at render time (web and mobile, streamed and stored replies)
 * and converts `\(…\)` / `\[…\]` to the dollar delimiters remark-math reads,
 * putting a one-line `$$…$$` on lines of its own so it renders as a block.
 */

/** Page the mobile app loads in a WebView to render a rich reply. */
export const AGENT_REPLY_EMBED_PATH = '/embed/agent-reply.html';

/** Global the mobile app sets before the embed page loads. */
export const AGENT_REPLY_EMBED_GLOBAL = '__SF_AGENT_REPLY__';

export const agentReplyEmbedPayloadSchema = z.object({
  markdown: z.string().max(100_000),
  theme: z.enum(['light', 'dark']).default('dark'),
});

export type AgentReplyEmbedPayload = z.output<typeof agentReplyEmbedPayloadSchema>;

/** Messages the embed page posts to the app. */
export const agentReplyEmbedMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('height'), value: z.number().nonnegative() }),
  z.object({ type: z.literal('link'), href: z.string().min(1) }),
]);

export type AgentReplyEmbedMessage = z.output<typeof agentReplyEmbedMessageSchema>;

interface ISegment {
  code: boolean;
  text: string;
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/** Splits markdown into code (fenced blocks, inline code) and prose segments. */
function splitCode(markdown: string): ISegment[] {
  const segments: ISegment[] = [];
  const push = (code: boolean, text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.code === code) {
      last.text += text;
    } else {
      segments.push({ code, text });
    }
  };
  const pushProse = (text: string) => {
    let index = 0;
    for (const match of text.matchAll(/`[^`\n]+`/g)) {
      const start = match.index ?? 0;
      push(false, text.slice(index, start));
      push(true, match[0]);
      index = start + match[0].length;
    }
    push(false, text.slice(index));
  };

  const lines = markdown.split(/(?<=\n)/);
  let fence: string | null = null;
  let prose = '';
  for (const line of lines) {
    const marker = FENCE_RE.exec(line)?.[1];
    if (fence) {
      push(true, line);
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (marker) {
      pushProse(prose);
      prose = '';
      fence = marker;
      push(true, line);
      continue;
    }
    prose += line;
  }
  pushProse(prose);
  return segments;
}

/** Display-math lines that a lost `\n` turned into a line break. */
const DISPLAY_NEWLINE_COMMANDS =
  /\n(?=(?:abla|eq|ewline|ot|exists|leq|geq|mid|parallel|subseteq|supseteq)(?![a-zA-Z]))/g;

function repairMath(prose: string): string {
  return prose.replace(
    /\$\$([\s\S]+?)\$\$|\$((?:\\.|[^$\\])+?)\$/g,
    (whole, display: string | undefined, inline: string | undefined) => {
      if (display !== undefined) {
        return `$$${display
          .replace(/\t/g, '\\t')
          .replace(/\r/g, '\\r')
          .replace(DISPLAY_NEWLINE_COMMANDS, '\\n')}$$`;
      }
      if (inline === undefined) return whole;
      // Inline math never spans lines; a break inside it was a lost `\n`.
      return `$${inline
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')}$`;
    },
  );
}

function normalizeProse(prose: string): string {
  // Form feed (from \frac, \forall) and backspace (from \beta) never belong in a reply.
  const restored = prose.split('\f').join('\\f').split('\b').join('\\b');
  const dollars = restored
    .replace(/\\\[([\s\S]+?)\\\]/g, (_whole, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_whole, body: string) => `$${body}$`);
  return repairMath(dollars).replace(
    /^([ \t]*)\$\$([^\n]+?)\$\$[ \t]*$/gm,
    // remark-math only shows $$…$$ as a centred block when the delimiters
    // stand on their own lines; models usually write it on one line.
    (_whole, indent: string, body: string) => `${indent}$$\n${indent}${body.trim()}\n${indent}$$`,
  );
}

/** Repairs JSON-escape damage and normalizes math delimiters (see above). */
export function normalizeAgentReplyMarkdown(markdown: string): string {
  return splitCode(markdown)
    .map((segment) => (segment.code ? segment.text : normalizeProse(segment.text)))
    .join('');
}

const RICH_FENCE_RE = /^ {0,3}(?:`{3,}|~{3,})\s*(?:mermaid|plotly|graph)\b/im;
const TABLE_RE = /^ *\|.*\|? *\n *\|? *:?-{3,}:? *(?:\| *:?-{3,}:? *)*\|? *$/m;
/** Pandoc's rule: no space after the opening `$`, none before the closing one. */
const INLINE_MATH_RE = /(?<![\\$])\$(?=[^\s$])[^$\n]*[^\s$\\]\$(?!\d)/;

/**
 * True when a reply has content that native text cannot show: a diagram or
 * plot block, a table, or a formula. "Costs $5 and $10" is not a formula.
 */
export function agentReplyNeedsRichView(markdown: string): boolean {
  if (RICH_FENCE_RE.test(markdown)) {
    return true;
  }
  const prose = splitCode(markdown)
    .filter((segment) => !segment.code)
    .map((segment) => segment.text)
    .join('');
  return TABLE_RE.test(prose) || prose.includes('$$') || INLINE_MATH_RE.test(prose);
}
