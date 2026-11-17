import { Linking } from 'react-native';
import Constants from 'expo-constants';
import type { Href } from 'expo-router';
import type { AgentReferencedItemType } from '@shared-types';
import { getItemWebUrl } from './libraryUtils';

/** A library item addressed by its source record id (not a directory-item index row id). */
export interface ILibraryItemRef {
  itemType: AgentReferencedItemType;
  id: string;
  title: string;
  directoryId?: string;
}

/** Kinds with a native player in v1 (decision 6); everything else opens on the web. */
export const NATIVE_STUDY_KINDS = new Set<AgentReferencedItemType>([
  'quiz',
  'flashcard',
]);

export function getWebOrigin(): string {
  const value: unknown = Constants.expoConfig?.extra?.NX_PUBLIC_WEB_APP_ORIGIN;
  return typeof value === 'string' && /^https?:\/\//.test(value)
    ? value.replace(/\/+$/, '')
    : 'https://study-forge-202604.web.app';
}

export function itemHref(item: ILibraryItemRef): Href | null {
  if (item.itemType === 'directory')
    return { pathname: '/dir/[id]', params: { id: item.id } };
  if (item.itemType === 'document')
    return { pathname: '/document/[id]', params: { id: item.id } };
  if (NATIVE_STUDY_KINDS.has(item.itemType)) {
    return {
      pathname: '/study/[kind]/[id]',
      params: { kind: item.itemType, id: item.id },
    };
  }
  return null;
}

export function itemWebUrl(item: ILibraryItemRef): string | null {
  if (item.itemType === 'directory')
    return `${getWebOrigin()}/directory/${encodeURIComponent(item.id)}`;
  return getItemWebUrl(getWebOrigin(), {
    id: item.id,
    sourceId: item.id,
    itemType: item.itemType,
    directoryId: item.directoryId ?? '',
    title: item.title,
    createdAt: '',
  });
}

export function openItemOnWeb(item: ILibraryItemRef): void {
  const url = itemWebUrl(item);
  if (url) void Linking.openURL(url).catch(() => undefined);
}

export function itemKindLabel(itemType: AgentReferencedItemType): string {
  switch (itemType) {
    case 'directory':
      return 'Directory';
    case 'document':
      return 'Document';
    case 'quiz':
      return 'Quiz';
    case 'flashcard':
      return 'Flashcard set';
    case 'slideDeck':
      return 'Slide deck';
    case 'diagramQuiz':
      return 'Diagram quiz';
    case 'sequenceQuiz':
      return 'Sequence quiz';
    case 'matchQuiz':
      return 'Match quiz';
  }
}

export function itemIcon(
  itemType: AgentReferencedItemType,
):
  | 'folder'
  | 'description'
  | 'quiz'
  | 'style'
  | 'slideshow'
  | 'schema'
  | 'format-list-numbered'
  | 'compare-arrows' {
  switch (itemType) {
    case 'directory':
      return 'folder';
    case 'document':
      return 'description';
    case 'quiz':
      return 'quiz';
    case 'flashcard':
      return 'style';
    case 'slideDeck':
      return 'slideshow';
    case 'diagramQuiz':
      return 'schema';
    case 'sequenceQuiz':
      return 'format-list-numbered';
    case 'matchQuiz':
      return 'compare-arrows';
  }
}
