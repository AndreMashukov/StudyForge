import type { AppDispatch } from '../../../store';
import { directoryApi } from '../../../store/api/Directory/DirectoryApi';

export function prefetchDirectoryContents(
  dispatch: AppDispatch,
  directoryId: string | null,
): void {
  dispatch(
    directoryApi.util.prefetch('getDirectoryContents', directoryId, { force: false }),
  );
}

export function prefetchDirectoryTree(dispatch: AppDispatch): void {
  dispatch(
    directoryApi.util.prefetch('getDirectoryTree', undefined, { force: false }),
  );
}
