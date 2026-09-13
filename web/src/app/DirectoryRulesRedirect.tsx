import { Navigate, useParams } from 'react-router-dom';
import { buildDirectoryPathWithOptionalName } from '../utils/directoryUrl';

export const DirectoryRulesRedirect = () => {
  const { directoryId } = useParams<{ directoryId: string }>();

  if (!directoryId) {
    return <Navigate to="/documents" replace />;
  }

  return (
    <Navigate
      to={buildDirectoryPathWithOptionalName(directoryId, undefined, 'rules')}
      replace
    />
  );
};
