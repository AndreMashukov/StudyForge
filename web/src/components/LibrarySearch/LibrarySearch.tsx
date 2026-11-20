import React, { useCallback } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  selectLibrarySearchOpen,
  setLibrarySearchOpen,
} from '../../store/slices/uiSlice';
import { extractDirectoryIdFromRouteParam } from '../../utils/directoryUrl';
import { LibrarySearchDialog } from './LibrarySearchDialog';
import { useLibrarySearchShortcut } from './hooks/useLibrarySearchShortcut';
import { useLibrarySearchSync } from './hooks/useLibrarySearchSync';

/**
 * Library search for the signed-in learner: keeps search records synced,
 * listens for Cmd/Ctrl+K and renders the search dialog. Mounted once in the
 * app shell.
 */
export const LibrarySearch: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.uid;
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectLibrarySearchOpen);
  const { directoryId: routeDirectoryId } = useParams<{ directoryId?: string }>();
  const { pathname } = useLocation();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      dispatch(setLibrarySearchOpen(next));
    },
    [dispatch],
  );
  const handleShortcut = useCallback(() => {
    if (userId) handleOpenChange(true);
  }, [userId, handleOpenChange]);

  useLibrarySearchShortcut(handleShortcut);
  useLibrarySearchSync(userId, open);

  if (!userId) {
    return null;
  }

  const currentDirectoryId = pathname.startsWith('/directory/')
    ? extractDirectoryIdFromRouteParam(routeDirectoryId)
    : null;

  return (
    <LibrarySearchDialog
      open={open}
      onOpenChange={handleOpenChange}
      userId={userId}
      currentDirectoryId={currentDirectoryId}
    />
  );
};
