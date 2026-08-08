import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useDirectoryDocumentsRealtimeCache } from '../../pages/DirectoryDetailPage/hooks/useDirectoryDocumentsRealtimeCache';
import { extractDirectoryIdFromRouteParam } from '../../utils/directoryUrl';

const ARTIFACT_PAGE_LIMIT = 100;

/**
 * Keeps directory Firestore listeners mounted while navigating directory routes,
 * avoiding watch-target teardown races that poison the Firestore client (ca9/b815 assertions).
 *
 * Subdirectory/document listing for directory detail is owned by RTK
 * `getDirectoryContentsWithArtifactSummaries` (items index onSnapshot). Do not
 * also invalidate via a directories parentId listener — that refetch races the
 * local cache and can drop a just-created subdirectory from the UI.
 */
export const DirectoryRealtimeBridge = () => {
  const { directoryId: routeDirectoryId } = useParams<{ directoryId?: string }>();
  const { pathname } = useLocation();

  const directoryId = useMemo(() => {
    if (routeDirectoryId) {
      return extractDirectoryIdFromRouteParam(routeDirectoryId);
    }

    return null;
  }, [routeDirectoryId]);

  const isActive = pathname.startsWith('/directory/');

  useDirectoryDocumentsRealtimeCache(isActive ? directoryId : null, {
    artifactLimit: ARTIFACT_PAGE_LIMIT,
    patchArtifactSummaries: isActive,
    patchDirectoryContents: false,
  });

  return null;
};
