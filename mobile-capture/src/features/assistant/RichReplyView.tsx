import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import { getWebOrigin } from '../library/itemNavigation';
import { openLink } from '../library/ReaderBlock';
import {
  isRichReplyPageUrl,
  parseRichReplyMessage,
  richReplyEmbedUrl,
  richReplyInjection,
} from './richReply';

/** Give up on the WebView and keep native text if the page has not drawn by then. */
const RICH_REPLY_TIMEOUT_MS = 10_000;

/**
 * One agent reply with tables, diagrams, formulas or plots, drawn by the web
 * app's embed page. The native `fallback` shows until the page reports its
 * height, and stays if the page fails to load (for example offline).
 */
export function RichReplyView({
  markdown,
  fallback,
}: {
  markdown: string;
  fallback: ReactNode;
}) {
  const [height, setHeight] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const embedUrl = useMemo(() => richReplyEmbedUrl(getWebOrigin()), []);
  const injection = useMemo(
    () => richReplyInjection({ markdown, theme: 'light' }),
    [markdown],
  );

  useEffect(() => {
    if (height !== null || failed) return;
    const timer = setTimeout(() => setFailed(true), RICH_REPLY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [height, failed]);

  if (failed) {
    return <>{fallback}</>;
  }

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = parseRichReplyMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'height') {
      setHeight(message.value);
    } else {
      openLink(message.href);
    }
  };

  const handleShouldStartLoad = (request: WebViewNavigation) => {
    if (isRichReplyPageUrl(request.url, embedUrl) || request.url === 'about:blank') {
      return true;
    }
    openLink(request.url);
    return false;
  };

  const ready = height !== null && height > 0;

  return (
    <View>
      {ready ? null : fallback}
      <View
        style={
          ready
            ? { height }
            : { height: 1, opacity: 0, position: 'absolute', left: 0, right: 0 }
        }
        pointerEvents={ready ? 'auto' : 'none'}
      >
        <WebView
          source={{ uri: embedUrl }}
          injectedJavaScriptBeforeContentLoaded={injection}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          originWhitelist={['https://*', 'http://*']}
          scrollEnabled={false}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          style={{ backgroundColor: 'transparent' }}
        />
      </View>
    </View>
  );
}
