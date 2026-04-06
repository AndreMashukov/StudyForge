import { Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../store';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { FullscreenProvider } from '../contexts/FullscreenContext';
import { ToastProvider, ToastContainer } from '../components/Toast';
import { ReduxToastBridge } from '../components/Toast/ReduxToastBridge';
import { MainLayout } from '../components/MainLayout';
import { ProtectedRoute } from '../utils/ProtectedRoute';
import { HomePage } from '../pages/HomePage';
import { AuthPage } from '../pages/AuthPage';
import { QuizPage } from '../pages/QuizPage';
import { CreateQuizPage } from '../pages/CreateQuizPage';
import { ProfilePage } from '../pages/ProfilePage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { CreateDocumentPage } from '../pages/CreateDocumentPage';
import { DocumentViewerPage } from '../pages/DocumentViewerPage';
import { RulesPage } from '../pages/RulesPage';
import { RuleEditorPage } from '../pages/RuleEditorPage';
import { DirectoryRulesPage } from '../pages/DirectoryRulesPage';
import { FlashcardSetPage } from '../pages/FlashcardSetPage';
import { CreateFlashcardPage } from '../pages/CreateFlashcardPage';
import { CreateSlideDeckPage } from '../pages/CreateSlideDeckPage';
import { SlideDeckPage } from '../pages/SlideDeckPage';
import { DiagramQuizPage } from '../pages/DiagramQuizPage';
import { CreateDiagramQuizPage } from '../pages/CreateDiagramQuizPage';
import { SequenceQuizPage } from '../pages/SequenceQuizPage';
import { CreateSequenceQuizPage } from '../pages/CreateSequenceQuizPage';
import { Page } from '../components/Page';
import { DirectoryDetailPage } from '../pages/DirectoryDetailPage';
import { QuizIndexRedirect } from '../utils/QuizIndexRedirect';

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <FullscreenProvider>
            <ToastProvider>
              <ReduxToastBridge />
              <AppContent />
              <ToastContainer />
            </ToastProvider>
          </FullscreenProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}

const AppContent = () => {
  const { loading } = useAuth();
  const { currentTheme } = useTheme();

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: currentTheme.colors.background }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-4 mx-auto"
            style={{
              borderColor: currentTheme.colors.muted,
              borderTopColor: currentTheme.colors.primary,
            }}
          ></div>
          <p
            className="mt-4 font-medium"
            style={{ color: currentTheme.colors.mutedForeground }}
          >
            Initializing...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Auth route - accessible when not authenticated */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Protected routes - wrapped in MainLayout */}
      <Route
        path="/"
        element={
          <MainLayout>
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/quiz/create"
        element={
          <MainLayout>
            <ProtectedRoute>
              <CreateQuizPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      {/* /quiz?directoryId= or /quiz/?directoryId= — no :quizId; send users to the folder */}
      <Route
        path="/quiz"
        element={
          <MainLayout>
            <ProtectedRoute>
              <QuizIndexRedirect />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/quiz/"
        element={
          <MainLayout>
            <ProtectedRoute>
              <QuizIndexRedirect />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/quiz/:quizId"
        element={
          <MainLayout>
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <MainLayout>
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      {/* Document Management Routes */}
      <Route
        path="/documents"
        element={
          <MainLayout>
            <ProtectedRoute>
              <DocumentsPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/documents/create"
        element={
          <MainLayout>
            <ProtectedRoute>
              <CreateDocumentPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/directory/:directoryId"
        element={
          <MainLayout>
            <DirectoryDetailPage />
          </MainLayout>
        }
      />
      <Route
        path="/document/:documentId"
        element={
          <MainLayout>
            <ProtectedRoute>
              <DocumentViewerPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      {/* Flashcard Management Routes */}
      <Route
        path="/flashcards/create"
        element={
          <MainLayout>
            <ProtectedRoute>
              <CreateFlashcardPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/flashcards/:flashcardSetId"
        element={
          <MainLayout>
            <ProtectedRoute>
              <FlashcardSetPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      {/* Slide Deck Management Routes */}
      <Route
        path="/slides/create"
        element={
          <MainLayout>
            <ProtectedRoute>
              <CreateSlideDeckPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/slides/:slideDeckId"
        element={
          <MainLayout>
            <ProtectedRoute>
              <SlideDeckPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      <Route
        path="/diagram-quiz/create"
        element={
          <MainLayout>
            <ProtectedRoute>
              <CreateDiagramQuizPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/diagram-quiz/:diagramQuizId"
        element={
          <MainLayout>
            <ProtectedRoute>
              <DiagramQuizPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      <Route
        path="/sequence-quiz/create"
        element={
          <MainLayout>
            <ProtectedRoute>
              <CreateSequenceQuizPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/sequence-quiz/:sequenceQuizId"
        element={
          <MainLayout>
            <ProtectedRoute>
              <SequenceQuizPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      {/* Quiz Management Routes */}
      <Route
        path="/quizzes/results"
        element={
          <MainLayout>
            <ProtectedRoute>
              <Page showSidebar={true}>
                <div className="max-w-4xl mx-auto">
                  <div className="text-center text-muted-foreground">
                    Quiz Results page coming soon...
                  </div>
                </div>
              </Page>
            </ProtectedRoute>
          </MainLayout>
        }
      />

      {/* Rule Editor Routes */}
      <Route
        path="/rules/editor"
        element={
          <MainLayout>
            <ProtectedRoute>
              <RuleEditorPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />
      <Route
        path="/rules/editor/:ruleId"
        element={
          <MainLayout>
            <ProtectedRoute>
              <RuleEditorPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      {/* Rules Management Route */}
      <Route
        path="/rules"
        element={
          <MainLayout>
            <ProtectedRoute>
              <RulesPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      {/* Directory Rules Management Route */}
      <Route
        path="/directories/:directoryId/rules"
        element={
          <MainLayout>
            <ProtectedRoute>
              <DirectoryRulesPage />
            </ProtectedRoute>
          </MainLayout>
        }
      />

      <Route
        path="/settings"
        element={
          <MainLayout>
            <ProtectedRoute>
              <Page showSidebar={true}>
                <div className="max-w-2xl mx-auto">
                  <div className="text-center text-muted-foreground">
                    Settings page coming soon...
                  </div>
                </div>
              </Page>
            </ProtectedRoute>
          </MainLayout>
        }
      />
    </Routes>
  );
};

export default App;
