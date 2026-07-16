/**
 * Server-side Mermaid sanitization — kept in sync with web MermaidDiagram.tsx.
 */

/** Characters that require a double-quoted Mermaid bracket label. */
const SPECIAL_BRACKET_LABEL_CHARS = /[/@\\()#&={}$[\]]/;

/**
 * Normalize label text that was incorrectly wrapped in single quotes.
 * Mermaid does not treat `'` as a delimiter — strip wrappers and remaining
 * apostrophe "escaping", then use plain or double-quoted form.
 */
export function normalizeSingleQuotedLabelContent(rawInner: string): string {
  let text = rawInner.trim();

  while (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    if (text.startsWith("''") && text.endsWith("''") && text.length >= 4) {
      text = text.slice(2, -2).trim();
    } else {
      text = text.slice(1, -1).trim();
    }
  }

  text = text.replace(/'/g, '').trim();
  if (!text) {
    return 'label';
  }

  if (SPECIAL_BRACKET_LABEL_CHARS.test(text) || text.includes('"')) {
    return `"${text.replace(/"/g, '')}"`;
  }

  return text;
}

/**
 * Find Mermaid bracket labels that open with a single quote.
 * Double-quoted labels (`Node["Label"]`) are allowed and are not flagged.
 */
export function findSingleQuotedBracketLabels(diagram: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < diagram.length; i += 1) {
    if (diagram[i] !== '[') {
      continue;
    }

    let contentStart = i + 1;
    if (diagram[contentStart] === '[') {
      contentStart += 1;
    }

    while (contentStart < diagram.length && /\s/.test(diagram[contentStart])) {
      contentStart += 1;
    }

    if (diagram[contentStart] !== "'") {
      continue;
    }

    const close = diagram.indexOf(']', contentStart);
    const snippet = diagram.slice(i, close === -1 ? Math.min(i + 48, diagram.length) : close + 1);
    found.push(snippet.replace(/\s+/g, ' ').trim());
  }
  return found;
}

/**
 * Rewrite `Node['Label']` / `Node[''Label'']` into plain or double-quoted labels.
 * Example: `cfg['include_contents='none'']` → `cfg["include_contents=none"]`.
 */
export function sanitizeSingleQuotedBracketLabels(source: string): string {
  let result = '';
  let index = 0;

  while (index < source.length) {
    if (source[index] !== '[') {
      result += source[index];
      index += 1;
      continue;
    }

    let opener = '[';
    let contentStart = index + 1;
    if (source[contentStart] === '[') {
      opener = '[[';
      contentStart += 1;
    }

    let scan = contentStart;
    while (scan < source.length && /\s/.test(source[scan])) {
      scan += 1;
    }

    if (source[scan] !== "'") {
      result += source[index];
      index += 1;
      continue;
    }

    const closeBracket = source.indexOf(']', contentStart);
    if (closeBracket === -1) {
      result += source[index];
      index += 1;
      continue;
    }

    let closeEnd = closeBracket + 1;
    if (opener === '[[' && source[closeEnd] === ']') {
      closeEnd += 1;
    }

    const inner = source.slice(contentStart, closeBracket);
    const normalized = normalizeSingleQuotedLabelContent(inner);
    const closer = opener === '[[' ? ']]' : ']';
    result += `${opener}${normalized}${closer}`;
    index = closeEnd;
  }

  return result;
}

function sanitizeBracketLabels(source: string): string {
  let result = source.replace(
    /\[([^\]"\n]*[/@\\()][^\]"\n]*)\]/g,
    (_match, inner: string) => `["${inner}"]`,
  );
  result = result.replace(
    /\[([^["\n\]]+\[[^\]\n]*\][^\]"\n]*)\]/g,
    (_match, inner: string) => `["${inner}"]`,
  );
  return result;
}

function sanitizeParenLabels(source: string): string {
  let result = source.replace(/\('([^'\n]*)'\)/g, (_match, inner: string) => {
    if (!/[()]/.test(inner)) {
      return _match;
    }
    const escaped = inner.replace(/\(/g, '#40;').replace(/\)/g, '#41;');
    return `('${escaped}')`;
  });
  result = result.replace(/\("([^"\n]*)"\)/g, (_match, inner: string) => {
    if (!/[()]/.test(inner)) {
      return _match;
    }
    const escaped = inner.replace(/\(/g, '#40;').replace(/\)/g, '#41;');
    return `("${escaped}")`;
  });
  return result;
}

function sanitizeSubgraphIds(source: string): string {
  const lines = source.split('\n');
  const idMap = new Map<string, string>();
  const subgraphLineIndices = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)subgraph\s+(?!end\b)(.+)$/);
    if (!match) {
      continue;
    }
    const raw = match[2].trim();
    if (/\[.*\]/.test(raw) || !/\s/.test(raw)) {
      continue;
    }

    const camelId = raw
      .split(/\s+/)
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
    idMap.set(raw, camelId);
    lines[i] = `${match[1]}subgraph ${camelId}["${raw}"]`;
    subgraphLineIndices.add(i);
  }

  if (idMap.size === 0) {
    return source;
  }

  for (let i = 0; i < lines.length; i++) {
    if (subgraphLineIndices.has(i)) {
      continue;
    }
    let line = lines[i];
    for (const [spacedName, camelId] of idMap) {
      const escaped = spacedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      line = line.replace(new RegExp(`\\b${escaped}\\b`, 'g'), camelId);
    }
    lines[i] = line;
  }

  return lines.join('\n');
}

function sanitizeSquareBracketsInParenLabels(source: string): string {
  return source.replace(
    /\(([^()'"\n[]+\[[^\]\n]*\][^()'"\n]*)\)/g,
    (_match, inner: string) => {
      const escaped = inner.replace(/\[/g, '#91;').replace(/\]/g, '#93;');
      return `(${escaped})`;
    },
  );
}

function sanitizeSquareBracketsInDiamondLabels(source: string): string {
  return source.replace(
    /\{([^{}\n]*\[[^\]\n]*\][^{}\n]*)\}/g,
    (_match, inner: string) => {
      const escaped = inner.replace(/\[/g, '#91;').replace(/\]/g, '#93;');
      return `{${escaped}}`;
    },
  );
}

function isErDiagramRelationshipLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '{' || trimmed === '}' || /^erDiagram\b/i.test(trimmed)) {
    return false;
  }
  if (!trimmed.includes(':') || !/--|\.\./.test(trimmed)) {
    return false;
  }
  // Entity attribute lines look like "string field_name" and never use relationship markers.
  if (/^\w+\s+\S+/.test(trimmed) && !/--|\.\./.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * erDiagram relationship labels (text after `:`) must be bare identifiers.
 * Gemini often emits SQL-style quoted column names (`'owner_id'`), which Mermaid rejects.
 */
function sanitizeErDiagramRelationshipLabels(source: string): string {
  if (!/^\s*erDiagram\b/im.test(source)) {
    return source;
  }

  return source
    .split('\n')
    .map((line) => {
      if (!isErDiagramRelationshipLine(line)) {
        return line;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        return line;
      }

      const prefix = line.slice(0, colonIndex + 1);
      const label = line
        .slice(colonIndex + 1)
        .replace(/['"]/g, '')
        .trim();
      return label ? `${prefix} ${label}` : prefix.trimEnd();
    })
    .join('\n');
}

function sanitizeNestedBracketsInBracketLabels(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      let result = '';
      let index = 0;
      while (index < line.length) {
        const wordBracket = line.slice(index).match(/^(\w+)\[/);
        if (wordBracket) {
          result += wordBracket[1] + '[';
          index += wordBracket[0].length;
          let depth = 1;
          let label = '';
          while (index < line.length && depth > 0) {
            const ch = line[index];
            if (ch === '[') {
              depth += 1;
              label += '#91;';
            } else if (ch === ']') {
              depth -= 1;
              if (depth > 0) {
                label += '#93;';
              } else {
                result += label + ']';
              }
            } else {
              label += ch;
            }
            index += 1;
          }
        } else {
          result += line[index];
          index += 1;
        }
      }
      return result;
    })
    .join('\n');
}

export function sanitizeMermaidCode(source: string): string {
  return sanitizeSubgraphIds(
    sanitizeParenLabels(
      sanitizeSquareBracketsInParenLabels(
        sanitizeSquareBracketsInDiamondLabels(
          sanitizeBracketLabels(
            sanitizeNestedBracketsInBracketLabels(
              sanitizeSingleQuotedBracketLabels(sanitizeErDiagramRelationshipLabels(source))
            )
          )
        )
      )
    )
  );
}
