import { Route, Routes, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AuthForm } from '../components/AuthForm';
import { UserProfile } from '../components/UserProfile';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-purple-200 border-r-purple-600 mx-auto animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Initializing Firebase Auth...</p>
          <div className="flex justify-center mt-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-700 to-purple-700 bg-clip-text text-transparent">
                Quiz AI Generator
              </h1>
            </div>
            {user && (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-700">Welcome back!</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {!user ? (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-700 to-purple-700 bg-clip-text text-transparent mb-4">
                Welcome to Quiz AI Generator
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Transform any web content into intelligent, engaging quizzes using the power of AI. 
                Simply provide a URL and watch as our AI creates comprehensive quizzes tailored to your content.
              </p>
              
              <div className="flex flex-wrap justify-center gap-6 mt-8">
                <div className="flex items-center bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">URL to Quiz</p>
                    <p className="text-sm text-gray-600">Instant conversion</p>
                  </div>
                </div>
                
                <div className="flex items-center bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">AI Powered</p>
                    <p className="text-sm text-gray-600">Smart question generation</p>
                  </div>
                </div>
                
                <div className="flex items-center bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Ready to Use</p>
                    <p className="text-sm text-gray-600">Export & share easily</p>
                  </div>
                </div>
              </div>
            </div>
            <AuthForm />
          </div>
        ) : (
          <div className="space-y-8">
            <Routes>
              <Route
                path="/"
                element={
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                      </div>
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
                        Dashboard
                      </h2>
                      <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                        Ready to transform web content into intelligent quizzes! 
                        Start by entering a URL and let our AI create engaging questions.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition duration-300">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                          </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Quiz</h3>
                        <p className="text-gray-600 mb-4">Generate a new quiz from any web URL using AI-powered content analysis.</p>
                        <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 font-medium">
                          Start Creating
                        </button>
                      </div>
                      
                      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition duration-300">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                          </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">My Quizzes</h3>
                        <p className="text-gray-600 mb-4">View and manage all your previously created quizzes in one place.</p>
                        <button className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200 font-medium">
                          View Quizzes
                        </button>
                      </div>
                      
                      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition duration-300">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                          </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics</h3>
                        <p className="text-gray-600 mb-4">Track quiz performance and user engagement with detailed analytics.</p>
                        <button className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 font-medium">
                          View Stats
                        </button>
                      </div>
                    </div>
                    
                    <UserProfile />
                  </div>
                }
              />
              <Route
                path="/profile"
                element={
                  <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
                        User Profile
                      </h2>
                      <p className="text-gray-600">Manage your account settings and preferences</p>
                    </div>
                    <UserProfile />
                  </div>
                }
              />
            </Routes>

            {/* Enhanced Navigation for authenticated users */}
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
              <nav className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl px-8 py-4 border border-gray-200">
                <ul className="flex space-x-8">
                  <li>
                    <Link
                      to="/"
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-semibold transition duration-200 group"
                    >
                      <svg className="w-5 h-5 group-hover:scale-110 transition duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0"></path>
                      </svg>
                      <span>Dashboard</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/profile"
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-semibold transition duration-200 group"
                    >
                      <svg className="w-5 h-5 group-hover:scale-110 transition duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                      <span>Profile</span>
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
