import {
  AGENT_REPLY_EMBED_GLOBAL,
  AGENT_REPLY_EMBED_PATH,
  agentReplyEmbedMessageSchema,
  agentReplyNeedsRichView,
  type AgentReplyEmbedMessage,
  type AgentReplyEmbedPayload,
} from '@shared-types';

/**
 * Rich agent replies on mobile: a finished reply with a table, diagram,
 * formula or plot renders in a WebView on the web app's embed page; anything
 * else, and any reply still streaming, keeps the native text blocks.
 */
export function shouldUseRichReplyView(input: {
  role: 'user' | 'assistant';
  streaming: boolean;
  normalizedContent: string;
}): boolean {
  return (
    input.role === 'assistant' &&
    !input.streaming &&
    agentReplyNeedsRichView(input.normalizedContent)
  );
}

export function richReplyEmbedUrl(webOrigin: string): string {
  return `${webOrigin.replace(/\/+$/, '')}${AGENT_REPLY_EMBED_PATH}`;
}

/** Script the WebView runs before the page loads: sets the reply payload. */
export function richReplyInjection(payload: AgentReplyEmbedPayload): string {
  const json = JSON.stringify(payload)
    .split(String.fromCharCode(0x2028))
    .join('\\u2028')
    .split(String.fromCharCode(0x2029))
    .join('\\u2029');
  return `window[${JSON.stringify(AGENT_REPLY_EMBED_GLOBAL)}] = ${json}; true;`;
}

/** Parses a message the embed page posted; null when it is not one of ours. */
export function parseRichReplyMessage(data: string): AgentReplyEmbedMessage | null {
  try {
    const parsed = agentReplyEmbedMessageSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Only the embed page itself may load inside the WebView. */
export function isRichReplyPageUrl(url: string, embedUrl: string): boolean {
  return url === embedUrl || url.startsWith(`${embedUrl}?`) || url.startsWith(`${embedUrl}#`);
}
