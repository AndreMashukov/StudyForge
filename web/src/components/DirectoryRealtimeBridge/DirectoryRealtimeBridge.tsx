import { useMemo } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useDirectoryDocumentsRealtimeCache } from '../../pages/DirectoryDetailPage/hooks/useDirectoryDocumentsRealtimeCache';

const ARTIFACT_PAGE_LIMIT = 100;

/**
 * Keeps directory Firestore listeners mounted while navigating between
 * directory detail and subject-world routes, avoiding watch-target teardown
 * races that poison the Firestore client (ca9/b815 assertions).
 *
 * Subdirectory/document listing for directory detail is owned by RTK
 * `getDirectoryContentsWithArtifactSummaries` (items index onSnapshot). Do not
 * also invalidate via a directories parentId listener — that refetch races the
 * local cache and can drop a just-created subdirectory from the UI.
 */
export const DirectoryRealtimeBridge = () => {
  const { directoryId: routeDirectoryId } = useParams<{ directoryId?: string }>();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();

  const directoryId = useMemo(() => {
    if (routeDirectoryId) return routeDirectoryId;

    const fromQuery = searchParams.get('directoryId')?.trim();
    if (!fromQuery) return null;

    if (
      pathname.startsWith('/subject-world/') ||
      pathname === '/subject-world/create'
    ) {
      return fromQuery;
    }

    return null;
  }, [routeDirectoryId, searchParams, pathname]);

  // Only run the bridge if we are actually on a route that needs it,
  // to avoid setting up global listeners that duplicate the page-level ones
  // or run unnecessarily when viewing other pages.
  const isActive = 
    pathname.startsWith('/directory/') || 
    pathname.startsWith('/subject-world/') ||
    pathname === '/subject-world/create';

  useDirectoryDocumentsRealtimeCache(isActive ? directoryId : null, {
    artifactLimit: ARTIFACT_PAGE_LIMIT,
    patchArtifactSummaries: isActive,
    patchDirectoryContents: false,
  });

  return null;
};
