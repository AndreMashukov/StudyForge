/**
 * Tokenizer shared by indexing, querying and snippets for library search.
 *
 * Text in spaced scripts (Latin, Cyrillic, Hangul, …) becomes one term per
 * word. Chinese, Japanese, Thai and other unspaced scripts have no word
 * boundaries to split on, so each run becomes overlapping character pairs
 * ("细胞呼吸" → 细胞, 胞呼, 呼吸); that makes any substring findable.
 */

export interface ISearchToken {
  /** Normalized term as stored in the index. */
  term: string;
  /** Offsets into the original text. */
  start: number;
  end: number;
  unspaced: boolean;
}

const WORD_RUN = /[\p{L}\p{N}\p{M}]+/gu;
const COMBINING_MARK = /\p{M}/gu;

/** Inclusive code point ranges of scripts written without spaces between words. */
const UNSPACED_RANGES: Array<[number, number]> = [
  [0x0e00, 0x0eff], // Thai, Lao
  [0x1000, 0x109f], // Myanmar
  [0x1780, 0x17ff], // Khmer
  [0x3040, 0x30ff], // Hiragana, Katakana
  [0x31f0, 0x31ff], // Katakana extensions
  [0x3400, 0x4dbf], // CJK extension A
  [0x4e00, 0x9fff], // CJK unified ideographs
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xff66, 0xff9f], // Halfwidth Katakana
  [0x20000, 0x2fa1f], // CJK extensions B and later
];

function isUnspacedCodePoint(codePoint: number): boolean {
  return UNSPACED_RANGES.some(
    ([from, to]) => codePoint >= from && codePoint <= to,
  );
}

/** Case- and accent-insensitive form: "Café" and "cafe" index as the same term. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFKD').replace(COMBINING_MARK, '').toLowerCase();
}

export function isUnspacedTerm(term: string): boolean {
  const codePoint = term.codePointAt(0);
  return codePoint !== undefined && isUnspacedCodePoint(codePoint);
}

interface ISymbol {
  value: string;
  start: number;
  unspaced: boolean;
}

function* tokensOfRun(run: string, runStart: number): Generator<ISearchToken> {
  const symbols: ISymbol[] = [];
  let offset = runStart;
  for (const value of run) {
    symbols.push({
      value,
      start: offset,
      unspaced: isUnspacedCodePoint(value.codePointAt(0) ?? 0),
    });
    offset += value.length;
  }

  let index = 0;
  while (index < symbols.length) {
    const unspaced = symbols[index].unspaced;
    let last = index;
    while (last + 1 < symbols.length && symbols[last + 1].unspaced === unspaced) {
      last += 1;
    }
    const endOf = (position: number) =>
      symbols[position].start + symbols[position].value.length;

    if (!unspaced || last === index) {
      const start = symbols[index].start;
      const end = endOf(last);
      const term = normalizeSearchText(run.slice(start - runStart, end - runStart));
      if (term) {
        yield { term, start, end, unspaced };
      }
    } else {
      for (let position = index; position < last; position += 1) {
        const start = symbols[position].start;
        const end = endOf(position + 1);
        yield {
          term: normalizeSearchText(run.slice(start - runStart, end - runStart)),
          start,
          end,
          unspaced: true,
        };
      }
    }
    index = last + 1;
  }
}

/** Lazily yields tokens with their position in `text`. */
export function* iterateSearchTokens(text: string): Generator<ISearchToken> {
  for (const match of text.matchAll(WORD_RUN)) {
    yield* tokensOfRun(match[0], match.index);
  }
}

export function tokenizeSearchText(text: string): string[] {
  const terms: string[] = [];
  for (const token of iterateSearchTokens(text)) {
    terms.push(token.term);
  }
  return terms;
}

/**
 * Unspaced runs of a query, normalized. Pair terms only prove that each pair
 * occurs somewhere, so a result is confirmed by finding the whole run.
 */
export function unspacedRuns(text: string): string[] {
  const runs: string[] = [];
  let current = '';
  for (const symbol of text) {
    if (isUnspacedCodePoint(symbol.codePointAt(0) ?? 0)) {
      current += symbol;
    } else if (current) {
      runs.push(current);
      current = '';
    }
  }
  if (current) {
    runs.push(current);
  }
  return runs.filter((run) => [...run].length > 1).map(normalizeSearchText);
}
