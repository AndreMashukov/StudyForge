export interface IPlannerResponseDeltaExtractor {
  push(chunk: string): string[];
  emittedText(): string;
}

export interface IReconcileStreamedPlannerReplyInput {
  parsedReply: string;
  streamedUserReply: string;
}

export interface IReconcileStreamedPlannerReplyResult {
  reply: string;
  remainder: string;
  streamed: boolean;
}

interface IJsonStringScan {
  value: string;
  end: number;
  complete: boolean;
}

interface IJsonSkipScan {
  end: number;
  complete: boolean;
}

interface IScannedPlannerJson {
  kind: 'unknown' | 'plan' | 'response';
  response: string;
}

function isJsonWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

function skipJsonWhitespace(raw: string, start: number): number {
  let index = start;
  while (index < raw.length && isJsonWhitespace(raw[index])) {
    index += 1;
  }
  return index;
}

function scanJsonString(raw: string, start: number): IJsonStringScan {
  let index = start + 1;
  let value = '';

  while (index < raw.length) {
    const char = raw[index];
    if (char === '\\') {
      if (index + 1 >= raw.length) {
        return { value, end: raw.length, complete: false };
      }
      const next = raw[index + 1];
      if (next === 'u') {
        if (index + 5 >= raw.length) {
          return { value, end: raw.length, complete: false };
        }
        const hex = raw.slice(index + 2, index + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
          return { value, end: raw.length, complete: false };
        }
        value += String.fromCharCode(Number.parseInt(hex, 16));
        index += 6;
        continue;
      }

      const escaped =
        next === 'n'
          ? '\n'
          : next === 'r'
            ? '\r'
            : next === 't'
              ? '\t'
              : next === 'b'
                ? '\b'
                : next === 'f'
                  ? '\f'
                  : next === '"' || next === '\\' || next === '/'
                    ? next
                    : next;
      value += escaped;
      index += 2;
      continue;
    }

    if (char === '"') {
      return { value, end: index + 1, complete: true };
    }

    value += char;
    index += 1;
  }

  return { value, end: raw.length, complete: false };
}

function skipNestedJsonContainer(raw: string, start: number): IJsonSkipScan {
  const open = raw[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === open) {
      depth += 1;
      continue;
    }
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return { end: index + 1, complete: true };
      }
    }
  }

  return { end: raw.length, complete: false };
}

function skipJsonValue(raw: string, start: number): IJsonSkipScan {
  const index = skipJsonWhitespace(raw, start);
  if (index >= raw.length) {
    return { end: index, complete: false };
  }

  const char = raw[index];
  if (char === '"') {
    const scanned = scanJsonString(raw, index);
    return { end: scanned.end, complete: scanned.complete };
  }
  if (char === '{' || char === '[') {
    return skipNestedJsonContainer(raw, index);
  }

  let cursor = index;
  while (cursor < raw.length && !isJsonWhitespace(raw[cursor])) {
    const next = raw[cursor];
    if (next === ',' || next === '}' || next === ']') {
      break;
    }
    cursor += 1;
  }

  return { end: cursor, complete: cursor > index && cursor < raw.length };
}

export function classifyPlannerStreamPayload(
  raw: string,
): 'json' | 'prose' | 'unknown' {
  let index = skipJsonWhitespace(raw, 0);
  if (index >= raw.length) {
    return 'unknown';
  }

  if (raw.startsWith('```', index)) {
    const newline = raw.indexOf('\n', index);
    if (newline < 0) {
      return 'unknown';
    }
    index = skipJsonWhitespace(raw, newline + 1);
    if (index >= raw.length) {
      return 'unknown';
    }
  }

  return raw[index] === '{' ? 'json' : 'prose';
}

function stripPlannerFencePrefix(raw: string): string {
  let index = skipJsonWhitespace(raw, 0);
  if (raw.startsWith('```', index)) {
    const newline = raw.indexOf('\n', index);
    if (newline >= 0) {
      index = newline + 1;
    }
  }
  return raw.slice(index);
}

function scanTopLevelPlannerJson(raw: string): IScannedPlannerJson {
  const objectStart = raw.indexOf('{');
  if (objectStart < 0) {
    return { kind: 'unknown', response: '' };
  }

  let kind: IScannedPlannerJson['kind'] = 'unknown';
  let response = '';
  let index = objectStart + 1;

  while (index < raw.length) {
    index = skipJsonWhitespace(raw, index);
    if (index >= raw.length) {
      break;
    }
    if (raw[index] === '}') {
      break;
    }
    if (raw[index] === ',') {
      index += 1;
      continue;
    }
    if (raw[index] !== '"') {
      break;
    }

    const keyScan = scanJsonString(raw, index);
    if (!keyScan.complete) {
      break;
    }
    index = skipJsonWhitespace(raw, keyScan.end);
    if (index >= raw.length || raw[index] !== ':') {
      break;
    }
    index = skipJsonWhitespace(raw, index + 1);
    if (index >= raw.length) {
      break;
    }

    if (keyScan.value === 'type' && raw[index] === '"') {
      const valueScan = scanJsonString(raw, index);
      if (valueScan.complete) {
        if (valueScan.value === 'plan' || valueScan.value === 'response') {
          kind = valueScan.value;
        }
        index = valueScan.end;
        continue;
      }
      break;
    }

    if (keyScan.value === 'response' && raw[index] === '"') {
      const valueScan = scanJsonString(raw, index);
      response = valueScan.value;
      if (!valueScan.complete) {
        break;
      }
      index = valueScan.end;
      continue;
    }

    const skipped = skipJsonValue(raw, index);
    if (!skipped.complete) {
      break;
    }
    index = skipped.end;
  }

  return { kind, response };
}

/**
 * Incremental reader for planner JSON. Forwards only decoded characters of the
 * last top-level `"response"` after the last top-level `"type"` is `response`.
 * Nested or earlier duplicate fields are ignored. Plan payloads emit nothing.
 */
export function createPlannerResponseDeltaExtractor(): IPlannerResponseDeltaExtractor {
  let raw = '';
  let emitted = '';

  return {
    push(chunk: string): string[] {
      if (chunk.length === 0) {
        return [];
      }

      raw += chunk;
      const payloadKind = classifyPlannerStreamPayload(raw);
      if (payloadKind === 'unknown') {
        return [];
      }

      const scanned =
        payloadKind === 'json' ? scanTopLevelPlannerJson(raw) : null;
      const visible =
        payloadKind === 'prose'
          ? stripPlannerFencePrefix(raw)
          : scanned?.kind === 'response'
            ? scanned.response
            : '';
      if (visible.length <= emitted.length) {
        return [];
      }

      const delta = visible.slice(emitted.length);
      emitted = visible;
      return delta.length > 0 ? [delta] : [];
    },
    emittedText(): string {
      return emitted;
    },
  };
}

export function reconcileStreamedPlannerReply(
  input: IReconcileStreamedPlannerReplyInput,
): IReconcileStreamedPlannerReplyResult {
  const parsedReply = input.parsedReply;
  const streamedUserReply = input.streamedUserReply;

  if (streamedUserReply.length === 0) {
    return {
      reply: parsedReply,
      remainder: parsedReply,
      streamed: parsedReply.length > 0,
    };
  }

  if (parsedReply.startsWith(streamedUserReply)) {
    return {
      reply: parsedReply,
      remainder: parsedReply.slice(streamedUserReply.length),
      streamed: true,
    };
  }

  if (
    streamedUserReply.startsWith(parsedReply) ||
    streamedUserReply.trim() === parsedReply
  ) {
    return {
      reply: parsedReply,
      remainder: '',
      streamed: true,
    };
  }

  return {
    reply: streamedUserReply,
    remainder: '',
    streamed: true,
  };
}
