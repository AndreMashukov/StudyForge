import { useMemo, useState } from 'react';
import { Image, Linking, ScrollView, Text as NativeText } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { Button, HeaderIconButton, Screen, ScreenHeader, Stack, Text } from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { queryKeys } from '../../lib/api/queryKeys';
import { getCallableErrorMessage } from '../../lib/api/studyforgeApi';
import { fetchDocumentContent, useLibraryDocument } from './libraryData';
import { parseDocumentBlocks, type IDocumentBlock } from './documentBlocks';

function getWebOrigin(): string {
  const origin: unknown = Constants.expoConfig?.extra?.NX_PUBLIC_WEB_APP_ORIGIN;
  return typeof origin === 'string' && /^https?:\/\//.test(origin) ? origin.replace(/\/+$/, '') : 'https://study-forge-202604.web.app';
}

function openLink(url: string): void {
  if (/^(https?:|mailto:)/i.test(url)) void Linking.openURL(url).catch(() => undefined);
}

function DocumentImage({ url, alt }: { url?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || !/^https?:\/\//i.test(url) || failed) return <Text tone="muted">{alt ? `Image unavailable: ${alt}` : 'Image unavailable'}</Text>;
  return <Image source={{ uri: url }} accessibilityLabel={alt || 'Document image'} onError={() => setFailed(true)} style={{ width: '100%', height: 240, resizeMode: 'contain', marginVertical: 8 }} />;
}

function ReaderBlock({ block }: { block: IDocumentBlock }) {
  if (block.kind === 'image') return <DocumentImage url={block.imageUrl} alt={block.alt} />;
  return (
    <NativeText
      style={{
        color: block.kind === 'placeholder' ? '#a1a1aa' : '#ffffff',
        fontSize: block.kind === 'heading' ? Math.max(19, 28 - (block.level ?? 1) * 2) : 16,
        fontWeight: block.kind === 'heading' ? '700' : '400',
        lineHeight: block.kind === 'heading' ? 34 : 25,
        marginVertical: 7,
        marginLeft: block.kind === 'list' ? Math.min(48, (block.level ?? 0) * 16) : 0,
        padding: block.kind === 'code' || block.kind === 'quote' ? 12 : 0,
        backgroundColor: block.kind === 'code' ? '#27272a' : 'transparent',
        fontFamily: block.kind === 'code' ? 'monospace' : undefined,
      }}
    >
      {block.kind === 'list' ? '• ' : ''}
      {block.spans.map((span, index) => (
        <NativeText key={index} onPress={span.href ? () => openLink(span.href ?? '') : undefined} style={{ fontWeight: span.bold ? '700' : undefined, fontStyle: span.italic ? 'italic' : undefined, fontFamily: span.code ? 'monospace' : undefined, color: span.href ? '#a78bfa' : undefined, textDecorationLine: span.href ? 'underline' : undefined }}>{span.text}</NativeText>
      ))}
    </NativeText>
  );
}

export function DocumentReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const documentId = typeof params.id === 'string' ? params.id : undefined;
  const { user } = useAuthUser();
  const documentQuery = useLibraryDocument(user?.uid, documentId);
  const document = documentQuery.data;
  const contentQuery = useQuery({
    queryKey: queryKeys.documentContent(user?.uid ?? '', documentId ?? '', `${document?.storagePath ?? ''}:${document?.contentFormat ?? ''}:${document?.generationStatus ?? ''}:${JSON.stringify(document?.updatedAt ?? '')}`),
    enabled: Boolean(user?.uid && document && document.generationStatus !== 'pending' && document.generationStatus !== 'failed'),
    queryFn: () => {
      if (!user?.uid || !document) throw new Error('Document unavailable');
      return fetchDocumentContent(user.uid, document);
    },
  });
  const blocks = useMemo(() => contentQuery.data ? parseDocumentBlocks(contentQuery.data.content, contentQuery.data.format) : [], [contentQuery.data]);
  const error = documentQuery.liveError ?? documentQuery.error ?? contentQuery.error;
  const origin = getWebOrigin();
  const showContent = Boolean(document && document.generationStatus !== 'pending' && document.generationStatus !== 'failed' && !error);

  return (
    <Screen className="pt-0">
      <ScreenHeader title={document?.title ?? 'Document'} leading={<HeaderIconButton icon="arrow-back" accessibilityLabel="Back to library" onPress={() => router.back()} />} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 20 }}>
        <Stack gap="sm">
          {documentId ? <Button label="Open original in browser" variant="secondary" onPress={() => openLink(`${origin}/document/${encodeURIComponent(documentId)}`)} /> : null}
          {documentQuery.isLoading ? <Text tone="muted">Loading document…</Text> : null}
          {!documentQuery.isLoading && !document && !error ? <Text tone="muted">This document is no longer available.</Text> : null}
          {document?.generationStatus === 'pending' ? <Text tone="muted">This document is generating. It will appear when ready.</Text> : null}
          {document?.generationStatus === 'failed' ? <Text tone="destructive">{document.generationError || 'Document generation failed.'}</Text> : null}
          {contentQuery.isLoading && document && document.generationStatus !== 'pending' && document.generationStatus !== 'failed' ? <Text tone="muted">Loading document content…</Text> : null}
          {error ? <><Text tone="destructive">{getCallableErrorMessage(error)}</Text><Button label="Retry" variant="secondary" onPress={() => { documentQuery.retryLive(); void documentQuery.refetch(); if (document) void contentQuery.refetch(); }} /></> : null}
          {showContent && contentQuery.data && blocks.length === 0 ? <Text tone="muted">This document has no readable content.</Text> : null}
          {showContent ? blocks.map((block, index) => <ReaderBlock key={index} block={block} />) : null}
        </Stack>
      </ScrollView>
    </Screen>
  );
}
