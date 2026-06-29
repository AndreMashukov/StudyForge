import { useMemo } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useRealtimeDirectorySync } from '../../pages/DocumentsPage/context/hooks/useRealtimeDirectorySync';
import { useDirectoryDocumentsRealtimeCache } from '../../pages/DirectoryDetailPage/hooks/useDirectoryDocumentsRealtimeCache';

const ARTIFACT_PAGE_LIMIT = 100;

/**
 * Keeps directory Firestore listeners mounted while navigating between
 * directory detail and subject-world routes, avoiding watch-target teardown
 * races that poison the Firestore client (ca9/b815 assertions).
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

  useRealtimeDirectorySync(directoryId, { subdirectoriesOnly: true });
  useDirectoryDocumentsRealtimeCache(directoryId, {
    artifactLimit: ARTIFACT_PAGE_LIMIT,
    patchArtifactSummaries: true,
    patchDirectoryContents: false,
  });

  return null;
};
