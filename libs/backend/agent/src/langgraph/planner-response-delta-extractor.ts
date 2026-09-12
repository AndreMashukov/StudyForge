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

/**
 * Incremental reader for planner JSON. Forwards only decoded characters of
 * `"response"` after `"type":"response"` is known. Plan payloads emit nothing.
 */
export function createPlannerResponseDeltaExtractor(): IPlannerResponseDeltaExtractor {
  let raw = '';
  let emitted = '';
  let kind: 'unknown' | 'plan' | 'response' = 'unknown';
  let responseValueStart = -1;

  const detectKind = (): 'unknown' | 'plan' | 'response' => {
    if (kind !== 'unknown') {
      return kind;
    }
    const typeMatch = /"type"\s*:\s*"(response|plan)"/.exec(raw);
    if (!typeMatch) {
      return 'unknown';
    }
    return typeMatch[1] === 'plan' ? 'plan' : 'response';
  };

  const findResponseValueStart = (): void => {
    if (responseValueStart >= 0) {
      return;
    }
    const match = /"response"\s*:\s*"/.exec(raw);
    if (!match) {
      return;
    }
    responseValueStart = match.index + match[0].length;
  };

  const decodeAvailableResponse = (): string => {
    if (responseValueStart < 0) {
      return '';
    }

    const slice = raw.slice(responseValueStart);
    let value = '';

    for (let index = 0; index < slice.length; index += 1) {
      const char = slice[index];
      if (char === '\\') {
        if (index + 1 >= slice.length) {
          break;
        }
        const next = slice[index + 1];
        if (next === 'u') {
          if (index + 5 >= slice.length) {
            break;
          }
          const hex = slice.slice(index + 2, index + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            break;
          }
          value += String.fromCharCode(Number.parseInt(hex, 16));
          index += 5;
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
        index += 1;
        continue;
      }

      if (char === '"') {
        break;
      }

      value += char;
    }

    return value;
  };

  return {
    push(chunk: string): string[] {
      if (kind === 'plan' || chunk.length === 0) {
        return [];
      }

      raw += chunk;

      if (kind === 'unknown') {
        kind = detectKind();
        if (kind !== 'response') {
          return [];
        }
      }

      findResponseValueStart();
      const decoded = decodeAvailableResponse();
      if (decoded.length <= emitted.length) {
        return [];
      }

      const delta = decoded.slice(emitted.length);
      emitted = decoded;
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
