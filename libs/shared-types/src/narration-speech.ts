/**
 * Spoken-text cleanup for narration (ADR 020): turns code into words a
 * listener can follow, and opaque strings (UUIDs, hashes, keys, URLs) into
 * short phrases. Deterministic and language-agnostic: the same text always
 * speaks the same way, so narration part keys stay stable.
 */

/** Code whose cleaned text is longer than this keeps the "Long code example" marker. */
export const SPOKEN_CODE_MAX_CHARS = 600;

/** Fence tags for data rather than code; such blocks are never read. */
const DATA_LANGUAGES = new Set([
  'json',
  'jsonc',
  'json5',
  'yaml',
  'yml',
  'xml',
  'csv',
  'tsv',
  'diff',
  'patch',
  'log',
  'output',
]);

const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TypeScript',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  golang: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  'c++': 'C++',
  cc: 'C++',
  cs: 'C sharp',
  csharp: 'C sharp',
  'c#': 'C sharp',
  php: 'PHP',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shell: 'shell',
  console: 'shell',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  dart: 'Dart',
  scala: 'Scala',
  lua: 'Lua',
  r: 'R',
  hcl: 'Terraform',
  terraform: 'Terraform',
  dockerfile: 'Dockerfile',
  docker: 'Dockerfile',
  graphql: 'GraphQL',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
};

/** True for a fence tag that marks data (JSON, YAML, logs, output…), not code. */
export function isDataCodeLanguage(language: string | undefined): boolean {
  return language !== undefined && DATA_LANGUAGES.has(language.toLowerCase());
}

/** The spoken name of a fence tag, or undefined when it is unknown or missing. */
export function spokenCodeLanguage(
  language: string | undefined,
): string | undefined {
  return language === undefined
    ? undefined
    : LANGUAGE_NAMES[language.toLowerCase()];
}

// ---------------------------------------------------------------------------
// Opaque strings
// ---------------------------------------------------------------------------

const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;
const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const JWT_RE = /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/g;
const KEY_CANDIDATE_RE = /[A-Za-z0-9_+/=-]{20,}/g;
const KEY_PREFIX_RE =
  /^(?:sk|pk|rk|ghp|gho|ghs|github_pat|xox[abprs])[_-]|^AKIA|^AIza/;
const HEX_RE = /\b(?:0x[0-9a-f]{8,}|[0-9a-f]{7,})\b/gi;
const LONG_NUMBER_RE = /\b\d{9,}\b/g;
const SENTINEL_RE = /\uE000(\d+)\uE000/g;

function isKeyLike(value: string): boolean {
  if (KEY_PREFIX_RE.test(value)) return true;
  const digits = value.replace(/\D/g, '').length;
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && digits >= 3;
}

function isHashLike(value: string): boolean {
  if (/^0x/i.test(value)) return true;
  return /\d/.test(value) && /[a-f]/i.test(value);
}

function urlPhrase(url: string): string {
  const host = url
    .replace(/^https?:\/\//i, '')
    .replace(/^[^@/]*@/, '')
    .split(/[/:?#]/)[0]
    .replace(/^www\./i, '');
  return host ? `a link to ${host}` : 'a link';
}

interface IProtectedText {
  /** The text with each opaque string replaced by a numbered sentinel. */
  text: string;
  phrases: string[];
}

/**
 * Replaces each opaque string with a sentinel naming its spoken phrase, so
 * later code rules cannot split it apart. Rules run in order: a URL is
 * replaced before the UUID inside it is seen.
 */
function protectOpaqueStrings(text: string): IProtectedText {
  const phrases: string[] = [];
  const sentinel = (phrase: string) => {
    phrases.push(phrase);
    return `\uE000${phrases.length - 1}\uE000`;
  };
  const result = text
    .replace(URL_RE, (match) => {
      const trailing = TRAILING_PUNCTUATION_RE.exec(match)?.[0] ?? '';
      const url = trailing ? match.slice(0, -trailing.length) : match;
      return sentinel(urlPhrase(url)) + trailing;
    })
    .replace(UUID_RE, () => sentinel('a UUID'))
    .replace(JWT_RE, () => sentinel('a token'))
    .replace(KEY_CANDIDATE_RE, (match) =>
      isKeyLike(match) ? sentinel('a key') : match,
    )
    .replace(HEX_RE, (match) =>
      isHashLike(match) ? sentinel('a hash') : match,
    )
    .replace(LONG_NUMBER_RE, () => sentinel('a long number'));
  return { text: result, phrases };
}

function restorePhrases(text: string, phrases: string[]): string {
  return text.replace(
    SENTINEL_RE,
    (_match, index: string) => phrases[Number(index)] ?? '',
  );
}

/**
 * Prose rule: opaque strings become short phrases ("a UUID", "a link to
 * github.com"); everything else is left for the speech model.
 */
export function speakOpaqueStrings(text: string): string {
  const { text: protectedText, phrases } = protectOpaqueStrings(text);
  return restorePhrases(protectedText, phrases);
}

// ---------------------------------------------------------------------------
// Code
// ---------------------------------------------------------------------------

const ACRONYM_RE = /^[A-Z]{2,4}$/;

/** `getUserById` → "get user by id", `MAX_RETRIES` → "max retries", `HTTPServer` → "HTTP server". */
export function splitIdentifier(identifier: string): string {
  // SCREAMING_CASE is a constant name, not acronyms: `MAX_RETRIES` → "max retries".
  const screaming = /_/.test(identifier) && !/[a-z]/.test(identifier);
  return identifier
    .split('_')
    .filter(Boolean)
    .flatMap((part) =>
      part
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(' '),
    )
    .filter(Boolean)
    .map((word) =>
      !screaming && ACRONYM_RE.test(word) ? word : word.toLowerCase(),
    )
    .join(' ');
}

const TOKEN_RE =
  /\uE000\d+\uE000|0[xob][0-9a-f_]+|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)*|===|!==|==|!=|<=|>=|=>|->|&&|\|\||\?\.|\+\+|--|\+=|-=|\*=|\/=|\s+|[\s\S]/gi;

const OPERATOR_WORDS: Record<string, string> = {
  '===': 'equals',
  '==': 'equals',
  '=': 'equals',
  '!==': 'not equal to',
  '!=': 'not equal to',
  '<=': 'at most',
  '>=': 'at least',
  '=>': 'returns',
  '->': 'returns',
  '&&': 'and',
  '||': 'or',
  '?.': 'dot',
  '++': 'plus plus',
  '+=': 'plus equals',
  '-=': 'minus equals',
  '*=': 'times equals',
  '/=': 'divided by equals',
};

/** Binary operators that are words only with a space on both sides. */
const SPACED_OPERATOR_WORDS: Record<string, string> = {
  '<': 'less than',
  '>': 'greater than',
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
  '%': 'mod',
};

const isSpace = (char: string | undefined) =>
  char !== undefined && /\s/.test(char);
const isWordChar = (char: string | undefined) =>
  char !== undefined && /[\w\uE000]/.test(char);

/** Code text (with opaque strings already protected) as spoken words. */
function speakCodeText(text: string, phrases: string[]): string {
  const words: string[] = [];
  const pause = () => {
    if (words.length && !words[words.length - 1].endsWith(',')) {
      words[words.length - 1] += ',';
    }
  };
  for (const match of text.matchAll(TOKEN_RE)) {
    const token = match[0];
    const at = match.index ?? 0;
    const before = text[at - 1];
    const after = text[at + token.length];
    if (/^\s+$/.test(token)) continue;
    if (token.startsWith('\uE000')) {
      words.push(restorePhrases(token, phrases));
    } else if (/^0[xob]/i.test(token) || /^\d/.test(token)) {
      words.push(token);
    } else if (/^[A-Za-z_]/.test(token)) {
      const spoken = splitIdentifier(token);
      if (spoken) words.push(spoken);
    } else if (OPERATOR_WORDS[token]) {
      words.push(OPERATOR_WORDS[token]);
    } else if (
      SPACED_OPERATOR_WORDS[token] &&
      isSpace(before) &&
      isSpace(after)
    ) {
      words.push(SPACED_OPERATOR_WORDS[token]);
    } else if (
      token === '-' &&
      after !== undefined &&
      /\d/.test(after) &&
      !isWordChar(before) &&
      before !== ')'
    ) {
      words.push('minus');
    } else if (token === '/') {
      // A path separator: `users/{id}/docs` → "users, id, docs".
      pause();
    } else if (
      token === '.' &&
      (isWordChar(before) || before === ')' || before === ']') &&
      isWordChar(after)
    ) {
      words.push('dot');
    } else if (
      token === '!' &&
      !isWordChar(before) &&
      (isWordChar(after) || after === '(')
    ) {
      words.push('not');
    }
    // Every other symbol (brackets, separators, `@ $ ^ ~ | &`, …) is dropped.
  }
  return words
    .join(' ')
    .replace(/,(?=\s*$)/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comment text as prose: decoration and JSDoc `@` dropped, opaque strings already protected. */
function speakCommentText(text: string, phrases: string[]): string {
  if (!/[\w\uE000]/.test(text)) return '';
  return restorePhrases(
    text.replace(/[^\w\s\uE000]{3,}/g, ' ').replace(/(^|\s)@(?=\w)/g, '$1'),
    phrases,
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** A string literal: prose is read as prose, anything else as code. */
function speakStringLiteral(content: string, phrases: string[]): string {
  const prose = /\s/.test(content.trim()) && /[a-z]{2,}/i.test(content);
  return prose
    ? restorePhrases(content, phrases).replace(/\s+/g, ' ').trim()
    : speakCodeText(content, phrases);
}

const PREPROCESSOR_RE =
  /^#\s*(?:include|define|undef|ifn?def|if|elif|else|endif|pragma)\b/;

interface ICommentState {
  /** Inside `/* … *\/` or `<!-- … -->`, with its closing delimiter. */
  closing: '*/' | '-->' | null;
}

/** True when a line comment starts at `at`. */
function lineCommentAt(line: string, at: number): boolean {
  const rest = line.slice(at);
  const before = line[at - 1];
  const startsWord = at === 0 || isSpace(before);
  if (rest.startsWith('//')) return before !== ':';
  if (rest.startsWith('#')) {
    if (!startsWord) return false;
    if (PREPROCESSOR_RE.test(rest)) return false;
    return !/^#[[{]/.test(rest);
  }
  if (rest.startsWith('-- ') || rest === '--') return startsWord;
  return false;
}

/**
 * One line of code as spoken pieces: code (with string literals in place),
 * then any comment as its own piece. Empty pieces are left out.
 */
function speakCodeLine(rawLine: string, state: ICommentState): string[] {
  const { text: line, phrases } = protectOpaqueStrings(rawLine);
  const pieces: string[] = [];
  let code = '';
  let spokenCode = '';
  const flushCode = () => {
    if (code) spokenCode += ` ${speakCodeText(code, phrases)}`;
    code = '';
  };
  const pushComment = (text: string) => {
    flushCode();
    if (spokenCode.trim()) pieces.push(spokenCode.trim());
    spokenCode = '';
    const comment = speakCommentText(text, phrases);
    if (comment) pieces.push(comment);
  };

  let at = 0;
  if (state.closing) {
    const end = line.indexOf(state.closing);
    const body = end < 0 ? line : line.slice(0, end);
    // A block comment's continuation lines start with ` * `.
    pushComment(body.replace(/^\s*\*(?!\/)/, ''));
    if (end < 0) return pieces;
    at = end + state.closing.length;
    state.closing = null;
  }

  while (at < line.length) {
    const char = line[at];
    if (line.startsWith('/*', at) || line.startsWith('<!--', at)) {
      const closing = line.startsWith('/*', at) ? '*/' : '-->';
      const open = closing === '*/' ? 2 : 4;
      const end = line.indexOf(closing, at + open);
      // `/**` opens a doc comment: the extra stars are not spoken.
      pushComment(
        line.slice(at + open, end < 0 ? undefined : end).replace(/^\*+/, ''),
      );
      if (end < 0) {
        state.closing = closing;
        return pieces;
      }
      at = end + closing.length;
      continue;
    }
    if (lineCommentAt(line, at)) {
      if (line.startsWith('#!', at) && at === 0) return pieces;
      pushComment(line.slice(at).replace(/^(?:\/\/+|#+|--)/, ''));
      return pieces;
    }
    if (char === '"' || char === "'" || char === '`') {
      let end = at + 1;
      while (end < line.length && line[end] !== char) {
        end += line[end] === '\\' ? 2 : 1;
      }
      if (end < line.length) {
        flushCode();
        const literal = speakStringLiteral(line.slice(at + 1, end), phrases);
        if (literal) spokenCode += ` ${literal}`;
        at = end + 1;
        continue;
      }
      // An unclosed quote is a symbol, dropped like any other.
    }
    code += char;
    at += 1;
  }
  flushCode();
  if (spokenCode.trim()) pieces.push(spokenCode.trim());
  return pieces;
}

function endSentence(text: string): string {
  return /[.!?:;…]$/.test(text) ? text : `${text}.`;
}

/**
 * A code block as spoken sentences, one per line (and one per trailing
 * comment), so each line ends with a pause. Lines with nothing to say are
 * left out.
 */
export function speakCodeBlock(code: string): string[] {
  const state: ICommentState = { closing: null };
  return code
    .split(/\r?\n/)
    .flatMap((line) => speakCodeLine(line, state))
    .map(endSentence);
}

/** Inline code inside a sentence: spoken words, no added pauses. */
export function speakInlineCode(code: string): string {
  const state: ICommentState = { closing: null };
  return code
    .split(/\r?\n/)
    .flatMap((line) => speakCodeLine(line, state))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
