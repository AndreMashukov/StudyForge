import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { AgentPromptContext } from '@shared-types';
import { useGetDirectoryQuery } from '../../store/api/Directory/DirectoryApi';
import { useGetDocumentQuery } from '../../store/api/Documents';
import { useGetQuizQuery } from '../../store/api/Quiz/QuizApi';
import { useGetFlashcardSetQuery } from '../../store/api/Flashcards/FlashcardsApi';
import { useGetSlideDeckQuery } from '../../store/api/SlideDecks/SlideDecksApi';
import { useGetDiagramQuizQuery } from '../../store/api/DiagramQuiz/DiagramQuizApi';
import { useGetSequenceQuizQuery } from '../../store/api/SequenceQuiz/SequenceQuizApi';
import { useGetMatchQuizQuery } from '../../store/api/MatchQuiz/MatchQuizApi';
import { useGetRuleQuery } from '../../store/api/Rules';
import { extractDirectoryIdFromRouteParam } from '../../utils/directoryUrl';

export type AgentLocationContextKind = 'workspace' | 'directory' | 'document' | 'rule';

export interface IAgentLocationContext {
  kind: Exclude<AgentLocationContextKind, 'workspace'>;
  promptContext: AgentPromptContext;
  label: string;
  tooltipPath: string;
}

type ResolvedRoute =
  | { type: 'directory'; directoryId: string }
  | { type: 'document'; documentId: string }
  | { type: 'rule'; ruleId: string }
  | {
      type: 'artifact';
      artifact:
        | 'quiz'
        | 'flashcardSet'
        | 'slideDeck'
        | 'diagramQuiz'
        | 'sequenceQuiz'
        | 'matchQuiz';
      artifactId: string;
      queryDirectoryId?: string;
    }
  | null;

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

function readQueryDirectoryId(search: string): string | undefined {
  const value = new URLSearchParams(search).get('directoryId')?.trim();
  return value && value.length > 0 ? value : undefined;
}

function resolveRoute(pathname: string, search: string, params: Record<string, string | undefined>): ResolvedRoute {
  const directoryRouteId = params.directoryId
    ? extractDirectoryIdFromRouteParam(params.directoryId)
    : pathname.match(/^\/directory\/([^/?#]+)/)?.[1]
      ? extractDirectoryIdFromRouteParam(pathname.match(/^\/directory\/([^/?#]+)/)?.[1])
      : null;
  if (directoryRouteId) {
    return { type: 'directory', directoryId: directoryRouteId };
  }

  const documentId = params.documentId?.trim() || pathname.match(/^\/document\/([^/?#]+)/)?.[1];
  if (documentId) {
    return { type: 'document', documentId };
  }

  const ruleId = params.ruleId?.trim() || pathname.match(/^\/rules\/editor\/([^/?#]+)/)?.[1];
  if (ruleId) {
    return { type: 'rule', ruleId };
  }

  const queryDirectoryId = readQueryDirectoryId(search);

  const quizId = params.quizId?.trim() || pathname.match(/^\/quiz\/([^/?#]+)/)?.[1];
  if (quizId && quizId !== 'create') {
    return { type: 'artifact', artifact: 'quiz', artifactId: quizId, queryDirectoryId };
  }

  const flashcardSetId =
    params.flashcardSetId?.trim() || pathname.match(/^\/flashcards\/([^/?#]+)/)?.[1];
  if (flashcardSetId && flashcardSetId !== 'create') {
    return {
      type: 'artifact',
      artifact: 'flashcardSet',
      artifactId: flashcardSetId,
      queryDirectoryId,
    };
  }

  const slideDeckId = params.slideDeckId?.trim() || pathname.match(/^\/slides\/([^/?#]+)/)?.[1];
  if (slideDeckId && slideDeckId !== 'create') {
    return { type: 'artifact', artifact: 'slideDeck', artifactId: slideDeckId, queryDirectoryId };
  }

  const diagramQuizId =
    params.diagramQuizId?.trim() || pathname.match(/^\/diagram-quiz\/([^/?#]+)/)?.[1];
  if (diagramQuizId && diagramQuizId !== 'create') {
    return {
      type: 'artifact',
      artifact: 'diagramQuiz',
      artifactId: diagramQuizId,
      queryDirectoryId,
    };
  }

  const sequenceQuizId =
    params.sequenceQuizId?.trim() || pathname.match(/^\/sequence-quiz\/([^/?#]+)/)?.[1];
  if (sequenceQuizId && sequenceQuizId !== 'create') {
    return {
      type: 'artifact',
      artifact: 'sequenceQuiz',
      artifactId: sequenceQuizId,
      queryDirectoryId,
    };
  }

  const matchQuizId =
    params.matchQuizId?.trim() || pathname.match(/^\/match-quiz\/([^/?#]+)/)?.[1];
  if (matchQuizId && matchQuizId !== 'create') {
    return {
      type: 'artifact',
      artifact: 'matchQuiz',
      artifactId: matchQuizId,
      queryDirectoryId,
    };
  }

  return null;
}

export function useAgentLocationContext(): IAgentLocationContext | null {
  const { pathname, search } = useLocation();
  const params = useParams();

  const route = useMemo(
    () => resolveRoute(pathname, search, params),
    [params, pathname, search],
  );

  const directoryRouteId = route?.type === 'directory' ? route.directoryId : undefined;
  const documentRouteId = route?.type === 'document' ? route.documentId : undefined;
  const ruleRouteId = route?.type === 'rule' ? route.ruleId : undefined;
  const artifact = route?.type === 'artifact' ? route : null;

  const quizQuery = useGetQuizQuery(
    { quizId: artifact?.artifact === 'quiz' ? artifact.artifactId : '' },
    { skip: artifact?.artifact !== 'quiz' },
  );
  const flashcardQuery = useGetFlashcardSetQuery(
    { flashcardSetId: artifact?.artifact === 'flashcardSet' ? artifact.artifactId : '' },
    { skip: artifact?.artifact !== 'flashcardSet' },
  );
  const slideDeckQuery = useGetSlideDeckQuery(
    { slideDeckId: artifact?.artifact === 'slideDeck' ? artifact.artifactId : '' },
    { skip: artifact?.artifact !== 'slideDeck' },
  );
  const diagramQuizQuery = useGetDiagramQuizQuery(
    { diagramQuizId: artifact?.artifact === 'diagramQuiz' ? artifact.artifactId : '' },
    { skip: artifact?.artifact !== 'diagramQuiz' },
  );
  const sequenceQuizQuery = useGetSequenceQuizQuery(
    { sequenceQuizId: artifact?.artifact === 'sequenceQuiz' ? artifact.artifactId : '' },
    { skip: artifact?.artifact !== 'sequenceQuiz' },
  );
  const matchQuizQuery = useGetMatchQuizQuery(
    { matchQuizId: artifact?.artifact === 'matchQuiz' ? artifact.artifactId : '' },
    { skip: artifact?.artifact !== 'matchQuiz' },
  );

  const artifactDirectoryId = useMemo(() => {
    if (!artifact) {
      return undefined;
    }

    if (artifact.artifact === 'quiz') {
      return quizQuery.data?.data?.quiz?.directoryId?.trim() || artifact.queryDirectoryId;
    }
    if (artifact.artifact === 'flashcardSet') {
      return flashcardQuery.data?.data?.directoryId?.trim() || artifact.queryDirectoryId;
    }
    if (artifact.artifact === 'slideDeck') {
      return slideDeckQuery.data?.data?.directoryId?.trim() || artifact.queryDirectoryId;
    }
    if (artifact.artifact === 'diagramQuiz') {
      return (
        diagramQuizQuery.data?.data?.diagramQuiz?.directoryId?.trim() || artifact.queryDirectoryId
      );
    }
    if (artifact.artifact === 'sequenceQuiz') {
      return (
        sequenceQuizQuery.data?.data?.sequenceQuiz?.directoryId?.trim() ||
        artifact.queryDirectoryId
      );
    }
    if (artifact.artifact === 'matchQuiz') {
      return (
        matchQuizQuery.data?.data?.matchQuiz?.directoryId?.trim() ||
        artifact.queryDirectoryId
      );
    }
    return undefined;
  }, [
    artifact,
    diagramQuizQuery.data?.data?.diagramQuiz?.directoryId,
    flashcardQuery.data?.data?.directoryId,
    matchQuizQuery.data?.data?.matchQuiz?.directoryId,
    quizQuery.data?.data?.quiz?.directoryId,
    sequenceQuizQuery.data?.data?.sequenceQuiz?.directoryId,
    slideDeckQuery.data?.data?.directoryId,
  ]);

  const documentQuery = useGetDocumentQuery(documentRouteId || '', {
    skip: !documentRouteId,
  });
  const ruleQuery = useGetRuleQuery(ruleRouteId || '', {
    skip: !ruleRouteId,
  });

  const resolvedDirectoryId =
    directoryRouteId ||
    artifactDirectoryId ||
    documentQuery.data?.directoryId?.trim() ||
    undefined;

  const directoryQuery = useGetDirectoryQuery(resolvedDirectoryId || '', {
    skip: !resolvedDirectoryId,
  });

  return useMemo(() => {
    if (route?.type === 'rule') {
      const rule = ruleQuery.data;
      const ruleId = rule?.id || route.ruleId;
      if (!ruleId) {
        return null;
      }

      const label = rule?.name?.trim() || 'Rule';
      const tooltipPath = `Rule / ${label}`;

      return {
        kind: 'rule' as const,
        label,
        tooltipPath,
        promptContext: {
          type: 'rule' as const,
          ruleId,
          label,
          path: tooltipPath,
        },
      };
    }

    if (route?.type === 'document') {
      const document = documentQuery.data;
      const documentId = document?.id || route.documentId;
      if (!documentId) {
        return null;
      }

      const directoryPath = directoryQuery.data?.path
        ? stripLeadingSlash(directoryQuery.data.path)
        : undefined;
      const label = document?.title?.trim() || 'Document';
      const tooltipPath = directoryPath ? `${directoryPath}/${label}` : label;
      const directoryId = document?.directoryId?.trim() || directoryQuery.data?.id;

      return {
        kind: 'document' as const,
        label,
        tooltipPath,
        promptContext: {
          type: 'document' as const,
          documentId,
          ...(directoryId ? { directoryId } : {}),
          label,
          path: tooltipPath,
        },
      };
    }

    if (!resolvedDirectoryId) {
      return null;
    }

    const directory = directoryQuery.data;
    const label = directory?.name?.trim() || 'Directory';
    const tooltipPath = directory?.path ? stripLeadingSlash(directory.path) : label;

    return {
      kind: 'directory' as const,
      label,
      tooltipPath,
      promptContext: {
        type: 'directory' as const,
        directoryId: resolvedDirectoryId,
        label,
        path: tooltipPath,
      },
    };
  }, [
    directoryQuery.data,
    documentQuery.data,
    resolvedDirectoryId,
    ruleQuery.data,
    route,
  ]);
}
