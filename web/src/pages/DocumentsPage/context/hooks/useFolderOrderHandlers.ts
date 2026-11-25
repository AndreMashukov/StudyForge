import { useCallback } from 'react';
import {
  useReorderDirectoriesMutation,
  useResetDirectoryOrderMutation,
} from '../../../../store/api/Directory/DirectoryApi';
import { useToast } from '../../../../components/Toast/ToastContext';

export interface IFolderOrderHandlers {
  handleReorderFolders: (orderedDirectoryIds: string[]) => void;
  handleResetFolderOrder: () => void;
  isResettingFolderOrder: boolean;
}

/** Saves drag-and-drop folder order (and Sort A–Z) for one parent folder. */
export function useFolderOrderHandlers(
  parentId: string | null,
): IFolderOrderHandlers {
  const { showToast } = useToast();
  const [reorderDirectories] = useReorderDirectoriesMutation();
  const [resetDirectoryOrder, { isLoading: isResettingFolderOrder }] =
    useResetDirectoryOrderMutation();

  const handleReorderFolders = useCallback(
    (orderedDirectoryIds: string[]) => {
      if (orderedDirectoryIds.length === 0) {
        return;
      }
      reorderDirectories({ parentId, orderedDirectoryIds })
        .unwrap()
        .catch(() => {
          showToast(
            'Could not save the folder order. Please try again.',
            'error',
          );
        });
    },
    [parentId, reorderDirectories, showToast],
  );

  const handleResetFolderOrder = useCallback(() => {
    resetDirectoryOrder({ parentId })
      .unwrap()
      .catch(() => {
        showToast('Could not sort the folders. Please try again.', 'error');
      });
  }, [parentId, resetDirectoryOrder, showToast]);

  return {
    handleReorderFolders,
    handleResetFolderOrder,
    isResettingFolderOrder,
  };
}
