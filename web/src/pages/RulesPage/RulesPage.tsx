import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { RulesPageProvider } from './context/RulesPageProvider';
import { RulesPageContainer } from './RulesPageContainer';

export const RulesPage = () => {
  return (
    <ProtectedRoute>
      <RulesPageProvider>
        <RulesPageContainer />
      </RulesPageProvider>
    </ProtectedRoute>
  );
};
