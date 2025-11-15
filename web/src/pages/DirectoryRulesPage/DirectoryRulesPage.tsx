import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { DirectoryRulesPageProvider } from './context/DirectoryRulesPageProvider';
import { DirectoryRulesPageContainer } from './DirectoryRulesPageContainer';

export const DirectoryRulesPage = () => {
  return (
    <ProtectedRoute>
      <DirectoryRulesPageProvider>
        <DirectoryRulesPageContainer />
      </DirectoryRulesPageProvider>
    </ProtectedRoute>
  );
};
