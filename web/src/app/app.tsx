import { Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../store';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { MainLayout } from '../components/MainLayout';
import { ProtectedRoute } from '../utils/ProtectedRoute';
import { HomePage } from '../pages/HomePage';
import { AuthPage } from '../pages/AuthPage';
import { QuizPage } from '../pages/QuizPage';

export function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Provider>
  );
}

const AppContent = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground font-medium">Initializing...</p>
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
              <div className="max-w-2xl mx-auto px-6 py-16">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    User Profile
                  </h2>
                  <p className="text-muted-foreground">Manage your account settings and preferences</p>
                </div>
                <div className="text-center text-muted-foreground">
                  Profile page coming soon...
                </div>
              </div>
            </ProtectedRoute>
          </MainLayout>
        } 
      />
    </Routes>
  );
};

export default App;
