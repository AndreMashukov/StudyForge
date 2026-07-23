import type { Directory } from '@shared-types';
import { buildDirectoryPathFromParts } from './directoryUrl';

export const DIRECTORY_DOCUMENTS_BACK_TARGET = '/documents';

export interface IDirectoryNavigationState {
  /** Where the directory page Back button should navigate. */
  backTarget: string;
  /** Back target for the parent page when returning via Back (drill-down only). */
  parentBackTarget?: string;
}

export function isDirectoryNavigationState(
  value: unknown
): value is IDirectoryNavigationState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.backTarget === 'string';
}

export function resolveDirectoryBackTarget(
  locationState: unknown,
  parentDirectory: Pick<Directory, 'id' | 'name'> | null,
): string {
  if (isDirectoryNavigationState(locationState)) {
    return locationState.backTarget;
  }
  if (parentDirectory) {
    return buildDirectoryPathFromParts(parentDirectory.id, parentDirectory.name);
  }
  return DIRECTORY_DOCUMENTS_BACK_TARGET;
}

export function resolveParentBackState(
  locationState: unknown
): IDirectoryNavigationState | undefined {
  if (!isDirectoryNavigationState(locationState) || !locationState.parentBackTarget) {
    return undefined;
  }
  return { backTarget: locationState.parentBackTarget };
}

export function buildChildDirectoryNavigationState(
  parentDirectory: Pick<Directory, 'id' | 'name'>,
  locationState: unknown,
): IDirectoryNavigationState {
  const parentBackTarget = isDirectoryNavigationState(locationState)
    ? locationState.backTarget
    : DIRECTORY_DOCUMENTS_BACK_TARGET;

  return {
    backTarget: buildDirectoryPathFromParts(parentDirectory.id, parentDirectory.name),
    parentBackTarget,
  };
}

export function buildTreeDirectoryNavigationState(): IDirectoryNavigationState {
  return { backTarget: DIRECTORY_DOCUMENTS_BACK_TARGET };
}
