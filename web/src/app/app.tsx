import { Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../store';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { MainLayout } from '../components/Layout';
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
  const { user, loading } = useAuth();

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

  // Show auth page if user is not authenticated
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  // Show main app if user is authenticated
  return (
    <MainLayout>
      <Routes>
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/quiz/:quizId" 
          element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
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
          } 
        />
      </Routes>
    </MainLayout>
  );
};

export default App;
