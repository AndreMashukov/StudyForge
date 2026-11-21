import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  HeaderIconButton,
  Heading,
  Screen,
  ScreenHeader,
  Text,
} from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import {
  useDirectoryTreeQuery,
  flattenDirectoryTree,
} from '../directories/api/directoryQueries';
import { queryKeys } from '../../lib/api/queryKeys';
import {
  generateFlashcards,
  generateQuiz,
  getCallableErrorMessage,
} from '../../lib/api/studyforgeApi';
import { useIsOnline } from '../../lib/network/online';
import { recordRecentlyOpened } from '../../lib/storage/recentlyOpened';
import { openLibraryItem } from '../assistant/ChatMessageView';
import { startChat } from '../assistant/chatNavigation';
import { BackOrMenuButton } from '../shell/HeaderButtons';
import { usePreferencesStore } from '../preferences/store/preferencesStore';
import { useShellStore } from '../shell/shellStore';
import {
  Chip,
  Composer,
  ItemRow,
  KeyboardAwareView,
  OfflineBanner,
  SectionLabel,
} from '../shell/ui';
import { fetchDocumentContent, useLibraryDocument } from './libraryData';
import { parseDocumentBlocks } from './documentBlocks';
import { ReaderBlock, openLink } from './ReaderBlock';
import { ScratchPadCard } from './ScratchPadCard';
import { TextSizeSheet } from './TextSizeSheet';
import { placeScratchPads } from './scratchPadPlacement';
import { useDocumentArtifacts } from './documentArtifacts';
import { getWebOrigin, itemIcon, itemKindLabel } from './itemNavigation';
import { NarrationBar } from '../narration/NarrationBar';
import { useDocumentNarration } from '../narration/useDocumentNarration';
import { useNarrationPlayer } from '../narration/useNarrationPlayer';

/** After the learner scrolls by hand, the reader stops following the narration for this long. */
const FOLLOW_PAUSE_AFTER_SCROLL_MS = 8_000;

type GenerateKind = 'quiz' | 'flashcards';

export function DocumentReaderScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const documentId = typeof params.id === 'string' ? params.id : undefined;
  const { user } = useAuthUser();
  const openCapture = useShellStore((state) => state.openCapture);
  const documentQuery = useLibraryDocument(user?.uid, documentId);
  const document = documentQuery.data;
  const artifactsQuery = useDocumentArtifacts(user?.uid, documentId);
  const treeQuery = useDirectoryTreeQuery();
  const directoryName = useMemo(
    () =>
      flattenDirectoryTree(treeQuery.data?.tree ?? []).find(
        (directory) => directory.id === document?.directoryId,
      )?.name,
    [document?.directoryId, treeQuery.data],
  );
  const [generating, setGenerating] = useState<GenerateKind | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [textSizeOpen, setTextSizeOpen] = useState(false);
  const textScale = usePreferencesStore((state) => state.readerTextScale);

  const ready = Boolean(
    document &&
      document.generationStatus !== 'pending' &&
      document.generationStatus !== 'failed',
  );
  const contentQuery = useQuery({
    queryKey: queryKeys.documentContent(
      user?.uid ?? '',
      documentId ?? '',
      `${document?.storagePath ?? ''}:${document?.contentFormat ?? ''}:${document?.generationStatus ?? ''}:${JSON.stringify(document?.updatedAt ?? '')}`,
    ),
    enabled: Boolean(user?.uid && ready),
    queryFn: () => {
      if (!user?.uid || !document) throw new Error('Document unavailable');
      return fetchDocumentContent(user.uid, document);
    },
  });
  const narration = useDocumentNarration(
    user?.uid,
    document,
    ready && Boolean(contentQuery.data),
    online,
  );
  const narrationRate = usePreferencesStore((state) => state.narrationRate);
  const narrationLoop = usePreferencesStore((state) => state.narrationLoop);
  const narrationParts = useMemo(
    () => narration.record?.parts ?? [],
    [narration.record],
  );
  const player = useNarrationPlayer({
    documentId,
    title: document?.title ?? '',
    parts: narrationParts,
    rate: narrationRate,
    loop: narrationLoop,
  });
  const activePart = narrationParts.find(
    (part) => part.index === player.currentPartIndex,
  );
  const scrollRef = useRef<ScrollView>(null);
  const blockOffsets = useRef(new Map<number, number>());
  const lastManualScroll = useRef(0);

  useEffect(() => {
    if (!activePart || player.status === 'idle' || player.status === 'ended')
      return;
    if (Date.now() - lastManualScroll.current < FOLLOW_PAUSE_AFTER_SCROLL_MS)
      return;
    const y = blockOffsets.current.get(activePart.blockStart);
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 96), animated: true });
    }
  }, [activePart?.index, activePart?.blockStart, player.status]);

  const entries = useMemo(
    () =>
      placeScratchPads(
        contentQuery.data
          ? parseDocumentBlocks(
              contentQuery.data.content,
              contentQuery.data.format,
            )
          : [],
        document?.scratchPads,
      ),
    [contentQuery.data, document?.scratchPads],
  );

  useEffect(() => {
    if (document)
      recordRecentlyOpened({
        itemType: 'document',
        id: document.id,
        title: document.title,
        directoryId: document.directoryId,
      });
  }, [document?.id, document?.title, document?.directoryId]);

  const error =
    documentQuery.liveError ?? documentQuery.error ?? contentQuery.error;

  const generate = async (kind: GenerateKind) => {
    if (!document) return;
    setGenerating(kind);
    setGenerateMessage(null);
    try {
      const request = {
        documentIds: [document.id],
        directoryId: document.directoryId,
      };
      await (kind === 'quiz'
        ? generateQuiz(request)
        : generateFlashcards(request));
      setGenerateMessage(
        kind === 'quiz'
          ? 'Quiz is generating. It will appear here when ready.'
          : 'Flashcards are generating. They will appear here when ready.',
      );
      await client.invalidateQueries({
        queryKey: ['documentArtifacts', user?.uid ?? '', document.id],
      });
    } catch (generateError) {
      setGenerateMessage(getCallableErrorMessage(generateError));
    } finally {
      setGenerating(null);
    }
  };

  return (
    <KeyboardAwareView>
      <Screen className="pt-0">
        <ScreenHeader
          title={directoryName ?? ''}
          leading={<BackOrMenuButton />}
          trailing={
            documentId ? (
              <>
                <HeaderIconButton
                  icon="format-size"
                  accessibilityLabel="Text size"
                  onPress={() => setTextSizeOpen(true)}
                />
                <HeaderIconButton
                  icon="open-in-new"
                  accessibilityLabel="Open in the web app"
                  onPress={() =>
                    openLink(
                      `${getWebOrigin()}/document/${encodeURIComponent(documentId)}`,
                    )
                  }
                />
              </>
            ) : null
          }
        />
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32 }}
          onScrollBeginDrag={() => {
            lastManualScroll.current = Date.now();
          }}
        >
          {document ? (
            <Heading level={1} className="mb-2">
              {document.title}
            </Heading>
          ) : null}
          {document && ready && contentQuery.data ? (
            <NarrationBar
              narration={narration}
              player={player}
              online={online}
            />
          ) : null}
          {documentQuery.isLoading && !document ? (
            <Text tone="muted">Loading document…</Text>
          ) : null}
          {!documentQuery.isLoading && !document && !error ? (
            <Text tone="muted">This document is no longer available.</Text>
          ) : null}
          {document?.generationStatus === 'pending' ? (
            <Text tone="muted">
              StudyForge is turning this into a document. It will appear here
              when ready.
            </Text>
          ) : null}
          {document?.generationStatus === 'failed' ? (
            <Text tone="destructive">
              {document.generationError || 'Document generation failed.'}
            </Text>
          ) : null}
          {contentQuery.isLoading && ready ? (
            <Text tone="muted">Loading document content…</Text>
          ) : null}
          {error ? (
            <>
              <Text tone="destructive">{getCallableErrorMessage(error)}</Text>
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => {
                  documentQuery.retryLive();
                  void documentQuery.refetch();
                  if (document) void contentQuery.refetch();
                }}
              />
            </>
          ) : null}
          {ready && contentQuery.data && entries.length === 0 ? (
            <Text tone="muted">This document has no readable content.</Text>
          ) : null}
          {ready && documentId
            ? entries.map((entry, index) =>
                entry.kind === 'block' ? (
                  <View
                    key={index}
                    onLayout={(event) => {
                      blockOffsets.current.set(
                        entry.blockIndex,
                        event.nativeEvent.layout.y,
                      );
                    }}
                  >
                    <ReaderBlock
                      block={entry.block}
                      textScale={textScale}
                      highlighted={Boolean(
                        activePart &&
                          player.status !== 'idle' &&
                          player.status !== 'ended' &&
                          entry.blockIndex >= activePart.blockStart &&
                          entry.blockIndex <= activePart.blockEnd,
                      )}
                    />
                  </View>
                ) : (
                  <ScratchPadCard
                    key={`pad-${entry.pad.sectionIndex}`}
                    documentId={documentId}
                    pad={entry.pad}
                  />
                ),
              )
            : null}

          {document && ready ? (
            <>
              <SectionLabel>Study this</SectionLabel>
              {(artifactsQuery.data ?? []).map((artifact) => (
                <ItemRow
                  key={`${artifact.itemType}:${artifact.id}`}
                  icon={itemIcon(artifact.itemType)}
                  title={artifact.title}
                  subtitle={itemKindLabel(artifact.itemType)}
                  badge={
                    artifact.generationStatus === 'pending'
                      ? 'Generating'
                      : artifact.generationStatus === 'failed'
                        ? 'Failed'
                        : undefined
                  }
                  onPress={
                    artifact.generationStatus === 'completed' ||
                    !artifact.generationStatus
                      ? () => openLibraryItem(router, artifact)
                      : undefined
                  }
                />
              ))}
              <View className="mt-2 flex-row gap-2">
                <Chip
                  label={generating === 'quiz' ? 'Queuing…' : 'Quiz'}
                  icon="add"
                  disabled={!online || generating !== null}
                  onPress={() => void generate('quiz')}
                />
                <Chip
                  label={
                    generating === 'flashcards' ? 'Queuing…' : 'Flashcards'
                  }
                  icon="add"
                  disabled={!online || generating !== null}
                  onPress={() => void generate('flashcards')}
                />
              </View>
              {generateMessage ? (
                <Text variant="caption" tone="muted" className="mt-2">
                  {generateMessage}
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </Screen>
      <OfflineBanner />
      {document ? (
        <Composer
          placeholder="Ask about this document"
          onCapture={() => openCapture(document.directoryId)}
          onSend={(message) =>
            startChat(router, {
              message,
              directoryId: document.directoryId,
              documentId: document.id,
              label: document.title,
            })
          }
        />
      ) : null}
      <TextSizeSheet
        visible={textSizeOpen}
        onClose={() => setTextSizeOpen(false)}
      />
    </KeyboardAwareView>
  );
}
