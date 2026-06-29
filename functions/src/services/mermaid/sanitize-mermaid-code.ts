/**
 * Server-side Mermaid sanitization — kept in sync with web MermaidDiagram.tsx.
 */

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
            sanitizeNestedBracketsInBracketLabels(sanitizeErDiagramRelationshipLabels(source)),
          ),
        ),
      ),
    ),
  );
}
