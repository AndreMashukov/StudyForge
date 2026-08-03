import { Navigate, useSearchParams } from 'react-router-dom';
import { CreateArtifactModalType } from '../components/CreateArtifactModal';
import { buildDirectoryPathWithOptionalName } from '../utils/directoryUrl';

interface ICreateArtifactRouteRedirectProps {
  directoryTab: string;
  artifactType: CreateArtifactModalType;
}

export const CreateArtifactRouteRedirect = ({
  directoryTab,
  artifactType,
}: ICreateArtifactRouteRedirectProps) => {
  const [searchParams] = useSearchParams();
  const directoryId = searchParams.get('directoryId')?.trim();
  const documentId = searchParams.get('documentId')?.trim();

  if (directoryId) {
    return (
      <Navigate
        to={buildDirectoryPathWithOptionalName(directoryId, undefined, directoryTab)}
        replace
        state={{
          openCreateArtifact: {
            artifactType,
            directoryId,
            ...(documentId ? { preselectedDocumentIds: [documentId] } : {}),
          },
        }}
      />
    );
  }

  return <Navigate to="/documents" replace />;
};
