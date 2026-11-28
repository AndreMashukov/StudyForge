import { describe, expect, it } from 'vitest';
import {
  isRichReplyPageUrl,
  parseRichReplyMessage,
  richReplyEmbedUrl,
  richReplyInjection,
  shouldUseRichReplyView,
} from './richReply';

describe('shouldUseRichReplyView', () => {
  const table = '| A | B |\n|---|---|\n| 1 | 2 |';

  it('uses the WebView for finished assistant replies with rich content', () => {
    expect(
      shouldUseRichReplyView({ role: 'assistant', streaming: false, normalizedContent: table }),
    ).toBe(true);
  });

  it('keeps native text while streaming, for user messages and plain replies', () => {
    expect(
      shouldUseRichReplyView({ role: 'assistant', streaming: true, normalizedContent: table }),
    ).toBe(false);
    expect(
      shouldUseRichReplyView({ role: 'user', streaming: false, normalizedContent: table }),
    ).toBe(false);
    expect(
      shouldUseRichReplyView({
        role: 'assistant',
        streaming: false,
        normalizedContent: 'Created 2 documents for 40 credits.',
      }),
    ).toBe(false);
  });
});

describe('embed helpers', () => {
  it('builds the page URL and an injection that round-trips the payload', () => {
    const url = richReplyEmbedUrl('https://example.web.app/');
    expect(url).toBe('https://example.web.app/embed/agent-reply.html');
    expect(isRichReplyPageUrl(url, url)).toBe(true);
    expect(isRichReplyPageUrl('https://example.web.app/documents', url)).toBe(false);

    const script = richReplyInjection({ markdown: 'a\u2028"b"</script>', theme: 'light' });
    const sandbox: Record<string, unknown> = {};
    new Function('window', script)(sandbox);
    expect(sandbox['__SF_AGENT_REPLY__']).toEqual({ markdown: 'a\u2028"b"</script>', theme: 'light' });
  });

  it('parses only messages from the embed page', () => {
    expect(parseRichReplyMessage('{"type":"height","value":120}')).toEqual({
      type: 'height',
      value: 120,
    });
    expect(parseRichReplyMessage('{"type":"link","href":"https://x.dev"}')).toEqual({
      type: 'link',
      href: 'https://x.dev',
    });
    expect(parseRichReplyMessage('not json')).toBeNull();
    expect(parseRichReplyMessage('{"type":"other"}')).toBeNull();
  });
});
