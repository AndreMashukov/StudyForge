import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { Page } from '../../components/Page';
import { RuleEditorContainer } from './components/RuleEditorContainer';

export const RuleEditorPage = () => {
  return (
    <Page showSidebar={true} className="h-full overflow-hidden">
      <ProtectedRoute>
        <RuleEditorContainer />
      </ProtectedRoute>
    </Page>
  );
};

export default RuleEditorPage;
