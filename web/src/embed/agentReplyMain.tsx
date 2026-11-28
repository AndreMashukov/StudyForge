import { StrictMode, useEffect, useRef } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  AGENT_REPLY_EMBED_GLOBAL,
  agentReplyEmbedPayloadSchema,
  normalizeAgentReplyMarkdown,
  type AgentReplyEmbedMessage,
  type AgentReplyEmbedPayload,
} from '@shared-types';
import { MarkdownRenderer } from '../components/MarkdownRenderer/MarkdownRenderer';
import { ThemeProvider } from '../contexts/ThemeContext';

/**
 * Renders one Workspace agent reply for the mobile app's WebView: tables,
 * Mermaid diagrams, formulas and plots, the same way the web agent panel does.
 * The app sets the payload on `window` before this page loads; the page posts
 * its height and link clicks back. No Firebase, store or app shell is loaded.
 */

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

function post(message: AgentReplyEmbedMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

function readPayload(): AgentReplyEmbedPayload {
  const parsed = agentReplyEmbedPayloadSchema.safeParse(
    Reflect.get(window, AGENT_REPLY_EMBED_GLOBAL),
  );
  return parsed.success ? parsed.data : { markdown: '', theme: 'dark' };
}

function AgentReplyEmbed({ payload }: { payload: AgentReplyEmbedPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    let lastHeight = -1;
    const report = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height !== lastHeight) {
        lastHeight = height;
        post({ type: 'height', value: height });
      }
    };
    const observer = new ResizeObserver(report);
    observer.observe(element);
    report();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Links open in the app's browser, never inside the WebView.
    const handleClick = (event: MouseEvent) => {
      if (!window.ReactNativeWebView || !(event.target instanceof Element)) {
        return;
      }
      const anchor = event.target.closest('a[href]');
      const href = anchor?.getAttribute('href');
      if (!anchor || !href || href.startsWith('#')) {
        return;
      }
      event.preventDefault();
      post({ type: 'link', href: new URL(href, window.location.href).toString() });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div ref={rootRef} className="px-0.5 py-0.5 text-[15px] leading-relaxed">
      <MarkdownRenderer
        content={normalizeAgentReplyMarkdown(payload.markdown)}
        richContent
        showToc={false}
        className="[&_p:last-child]:!mb-0 [&_ul:last-child]:!mb-0 [&_ol:last-child]:!mb-0 [&_>div:last-child]:!mb-0"
      />
    </div>
  );
}

const payload = readPayload();
document.documentElement.classList.toggle('dark', payload.theme === 'dark');
document.body.style.background = 'transparent';

const container = document.getElementById('root');
if (container) {
  ReactDOM.createRoot(container).render(
    <StrictMode>
      {/* Sets the colour variables the app's classes read; never saved. */}
      <ThemeProvider
        storageKey="sf-agent-reply-embed-theme"
        defaultTheme={payload.theme === 'dark' ? 'linear' : 'light'}
      >
        <AgentReplyEmbed payload={payload} />
      </ThemeProvider>
    </StrictMode>,
  );
}
