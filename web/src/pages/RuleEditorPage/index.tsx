import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { Page } from '../../components/Page';
import { RuleEditorContainer } from './components/RuleEditorContainer';

export const RuleEditorPage = () => {
  return (
    <Page showSidebar={true}>
      <ProtectedRoute>
        <RuleEditorContainer />
      </ProtectedRoute>
    </Page>
  );
};

export default RuleEditorPage;
