import type { ApiResponse, ArtifactSummary, ArtifactSummaryType } from '@shared-types';
import type { AppDispatch, RootState } from '../../index';
import { baseApi } from '../baseApi';
import { directoryApi } from '../Directory/DirectoryApi';
import type { ArtifactPanelType } from '../../slices/artifactGenerationSlice';

interface DirectoryContentsQueryArgs {
  directoryId: string;
  artifactLimit: number;
}

const ARTIFACT_NAME_FIELDS = [
  'quizName',
  'diagramQuizName',
  'sequenceQuizName',
  'subjectWorldName',
  'title',
] as const;

export function getOptimisticArtifactTitle(arg: Record<string, unknown>): string | undefined {
  for (const field of ARTIFACT_NAME_FIELDS) {
    const value = arg[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

const ARTIFACT_PANEL_CONFIG: Partial<
  Record<Exclude<ArtifactPanelType, 'sources'>, { summaryType: ArtifactSummaryType; getRecordId: (data: ApiResponse<unknown>) => string | undefined }>
> = {
  quizzes: {
    summaryType: 'quiz',
    getRecordId: (data) => (data.data as { quizId?: string } | undefined)?.quizId,
  },
  cards: {
    summaryType: 'flashcard',
    getRecordId: (data) => (data.data as { flashcardSetId?: string } | undefined)?.flashcardSetId,
  },
  slides: {
    summaryType: 'slideDeck',
    getRecordId: (data) => (data.data as { slideDeckId?: string } | undefined)?.slideDeckId,
  },
  diagramQuizzes: {
    summaryType: 'diagramQuiz',
    getRecordId: (data) => (data.data as { diagramQuizId?: string } | undefined)?.diagramQuizId,
  },
  sequenceQuizzes: {
    summaryType: 'sequenceQuiz',
    getRecordId: (data) => (data.data as { sequenceQuizId?: string } | undefined)?.sequenceQuizId,
  },
  subjectWorlds: {
    summaryType: 'subjectWorld',
    getRecordId: (data) => (data.data as { subjectWorldId?: string } | undefined)?.subjectWorldId,
  },
};

function forEachDirectoryContentsCache(
  state: RootState,
  directoryId: string,
  fn: (args: DirectoryContentsQueryArgs) => void,
): void {
  const queries = state[baseApi.reducerPath].queries;
  for (const entry of Object.values(queries)) {
    if (!entry || entry.endpointName !== 'getDirectoryContentsWithArtifactSummaries') {
      continue;
    }
    const args = entry.originalArgs as DirectoryContentsQueryArgs | undefined;
    if (args?.directoryId === directoryId) {
      fn(args);
    }
  }
}

export function upsertArtifactSummaryInDirectoryCaches(
  dispatch: AppDispatch,
  getState: () => unknown,
  directoryId: string,
  artifact: ArtifactSummary,
): void {
  upsertArtifactSummaryInDirectoryState(getState() as RootState, dispatch, directoryId, artifact);
}

function upsertArtifactSummaryInDirectoryState(
  state: RootState,
  dispatch: AppDispatch,
  directoryId: string,
  artifact: ArtifactSummary,
): void {
  forEachDirectoryContentsCache(state, directoryId, (args) => {
    dispatch(
      directoryApi.util.updateQueryData('getDirectoryContentsWithArtifactSummaries', args, (draft) => {
        const idx = draft.artifactSummaries.findIndex(
          (summary) => summary.id === artifact.id && summary.type === artifact.type,
        );
        if (idx >= 0) {
          Object.assign(draft.artifactSummaries[idx], artifact);
        } else {
          draft.artifactSummaries.unshift(artifact);
        }
      }),
    );
  });
}

export function patchPendingArtifactSummaryFromResponse(
  dispatch: AppDispatch,
  getState: () => unknown,
  artifactType: ArtifactPanelType,
  directoryId: string,
  arg: Record<string, unknown>,
  data: ApiResponse<unknown>,
): void {
  if (artifactType === 'sources') {
    return;
  }

  const config = ARTIFACT_PANEL_CONFIG[artifactType];
  if (!config || data.success === false) {
    return;
  }

  const recordId = config.getRecordId(data);
  if (!recordId) {
    return;
  }

  const ruleIds = Array.isArray(arg.ruleIds)
    ? arg.ruleIds.filter((ruleId): ruleId is string => typeof ruleId === 'string')
    : undefined;

  upsertArtifactSummaryInDirectoryCaches(dispatch, getState, directoryId, {
    id: recordId,
    title: getOptimisticArtifactTitle(arg) ?? 'Untitled',
    type: config.summaryType,
    createdAt: new Date().toISOString(),
    generationStatus: 'pending',
    appliedRuleIds: ruleIds,
  });
}
