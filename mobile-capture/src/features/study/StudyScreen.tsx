import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  HeaderIconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  Text,
} from '@studyforge/mobile-ui';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { getCallableErrorMessage } from '../../lib/api/studyforgeApi';
import { recordRecentlyOpened } from '../../lib/storage/recentlyOpened';
import { BackOrMenuButton } from '../shell/HeaderButtons';
import { OfflineBanner } from '../shell/ui';
import { openItemOnWeb } from '../library/itemNavigation';
import { FlashcardPlayer } from './FlashcardPlayer';
import { QuizPlayer } from './QuizPlayer';
import { useFlashcardSetQuery, useQuizQuery } from './studyData';

/** Native players for quizzes and flashcard sets (decision 6). */
export function StudyScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const kind =
    params.kind === 'quiz'
      ? 'quiz'
      : params.kind === 'flashcard'
        ? 'flashcard'
        : null;
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { user } = useAuthUser();
  const quizQuery = useQuizQuery(user?.uid, kind === 'quiz' ? id : undefined);
  const setQuery = useFlashcardSetQuery(
    user?.uid,
    kind === 'flashcard' ? id : undefined,
  );
  const active = kind === 'quiz' ? quizQuery : setQuery;
  const record = kind === 'quiz' ? quizQuery.data : setQuery.data;

  useEffect(() => {
    if (record && kind)
      recordRecentlyOpened({
        itemType: kind,
        id: record.id,
        title: record.title,
        directoryId: record.directoryId,
      });
  }, [kind, record?.id, record?.title, record?.directoryId]);

  if (!kind || !id) {
    return (
      <Screen className="pt-0">
        <ScreenHeader title="Study" leading={<BackOrMenuButton />} />
        <Text tone="muted" className="mt-6">
          This study item can't be opened in the app.
        </Text>
      </Screen>
    );
  }
  if (active.isLoading && !record) return <LoadingState message="Loading…" />;

  const pending = record?.generationStatus === 'pending';
  const failed = record?.generationStatus === 'failed';

  return (
    <View className="flex-1 bg-background">
      <Screen className="pt-0">
        <ScreenHeader
          title={record?.title ?? (kind === 'quiz' ? 'Quiz' : 'Flashcards')}
          leading={<BackOrMenuButton />}
          trailing={
            record ? (
              <HeaderIconButton
                icon="open-in-new"
                accessibilityLabel="Open in the web app"
                onPress={() =>
                  openItemOnWeb({
                    itemType: kind,
                    id: record.id,
                    title: record.title,
                    directoryId: record.directoryId,
                  })
                }
              />
            ) : null
          }
        />
        <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
          {active.error ? (
            <Text tone="destructive">
              {getCallableErrorMessage(active.error)}
            </Text>
          ) : null}
          {!record && !active.error ? (
            <Text tone="muted">This item is no longer available.</Text>
          ) : null}
          {pending ? (
            <Text tone="muted">
              Still generating. It will be ready shortly.
            </Text>
          ) : null}
          {failed ? (
            <Text tone="destructive">
              {record?.generationError ?? 'Generation failed.'}
            </Text>
          ) : null}
          {user && quizQuery.data && !pending && !failed ? (
            <QuizPlayer userId={user.uid} quiz={quizQuery.data} />
          ) : null}
          {user && setQuery.data && !pending && !failed ? (
            <FlashcardPlayer userId={user.uid} set={setQuery.data} />
          ) : null}
        </ScrollView>
      </Screen>
      <OfflineBanner />
    </View>
  );
}
