import { Route, Routes, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AuthForm } from '../components/AuthForm';
import { UserProfile } from '../components/UserProfile';
import { Icon } from '../components/ui/icon';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary mx-auto"></div>
          </div>
          <p className="mt-4 text-muted-foreground font-medium">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Modern header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md">
                <Icon size={20} className="text-primary-foreground">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </Icon>
              </div>
              <h1 className="text-xl font-semibold text-foreground">
                Quiz AI Generator
              </h1>
            </div>
            {user && (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-foreground">Welcome back!</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <span className="text-accent-foreground font-medium text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {!user ? (
          <div className="space-y-16">
            {/* Hero Section - Clean and Spacious */}
            <div className="text-center space-y-8">
              {/* Logo/Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Icon size={32} className="text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </Icon>
                </div>
              </div>

              {/* Heading */}
              <div className="space-y-6">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight">
                  AI Quiz Generator
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4">
                  Transform any web content into intelligent, engaging quizzes using advanced AI. 
                  Simply provide a URL and let our AI create comprehensive quizzes tailored to your content.
                </p>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <div className="inline-flex items-center bg-card rounded-full px-4 py-2 border border-border">
                  <Icon size={16} className="text-primary mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                  </Icon>
                  <span className="text-sm font-medium text-foreground">URL to Quiz</span>
                </div>
                
                <div className="inline-flex items-center bg-card rounded-full px-4 py-2 border border-border">
                  <Icon size={16} className="text-green-500 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </Icon>
                  <span className="text-sm font-medium text-foreground">AI Powered</span>
                </div>
                
                <div className="inline-flex items-center bg-card rounded-full px-4 py-2 border border-border">
                  <Icon size={16} className="text-blue-500 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </Icon>
                  <span className="text-sm font-medium text-foreground">Ready to Use</span>
                </div>
              </div>
            </div>

            {/* Auth Form Section */}
            <div className="max-w-md mx-auto">
              <AuthForm />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <Routes>
              <Route
                path="/"
                element={
                  <div className="space-y-8">
                    {/* Dashboard Header */}
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/70 rounded-xl flex items-center justify-center shadow-lg">
                          <Icon size={28} className="text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                          </Icon>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-3xl font-bold text-foreground">
                          Dashboard
                        </h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                          Ready to transform web content into intelligent quizzes! 
                          Start by entering a URL and let our AI create engaging questions.
                        </p>
                      </div>
                    </div>
                    
                    {/* Feature Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                      <div className="group bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md hover:border-border/80 transition-all duration-200">
                        <div className="space-y-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                            <Icon size={24} className="text-primary">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </Icon>
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">Create Quiz</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">Generate a new quiz from any web URL using AI-powered content analysis.</p>
                          </div>
                          <button className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm">
                            Start Creating
                          </button>
                        </div>
                      </div>
                      
                      <div className="group bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md hover:border-border/80 transition-all duration-200">
                        <div className="space-y-4">
                          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                            <Icon size={24} className="text-accent-foreground">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                            </Icon>
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">My Quizzes</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">View and manage all your previously created quizzes in one place.</p>
                          </div>
                          <button className="w-full py-2.5 px-4 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors font-medium text-sm">
                            View Quizzes
                          </button>
                        </div>
                      </div>
                      
                      <div className="group bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md hover:border-border/80 transition-all duration-200">
                        <div className="space-y-4">
                          <div className="w-12 h-12 bg-secondary/50 rounded-xl flex items-center justify-center group-hover:bg-secondary/60 transition-colors">
                            <Icon size={24} className="text-foreground">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </Icon>
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">Analytics</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">Track quiz performance and user engagement with detailed analytics.</p>
                          </div>
                          <button className="w-full py-2.5 px-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium text-sm">
                            View Stats
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* User Profile Section */}
                    <div className="pt-8 border-t border-border">
                      <UserProfile />
                    </div>
                  </div>
                }
              />
              <Route
                path="/profile"
                element={
                  <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-foreground mb-2">
                        User Profile
                      </h2>
                      <p className="text-muted-foreground">Manage your account settings and preferences</p>
                    </div>
                    <UserProfile />
                  </div>
                }
              />
            </Routes>

            {/* Modern bottom navigation for authenticated users */}
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
              <nav className="bg-card/90 backdrop-blur-md rounded-xl shadow-lg px-6 py-3 border border-border">
                <ul className="flex space-x-6">
                  <li>
                    <Link
                      to="/"
                      className="flex items-center space-x-2 text-primary hover:text-primary/80 font-medium smooth-transition group"
                    >
                      <Icon size={18} className="group-hover:scale-105 smooth-transition">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0"></path>
                      </Icon>
                      <span>Dashboard</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/profile"
                      className="flex items-center space-x-2 text-primary hover:text-primary/80 font-medium smooth-transition group"
                    >
                      <Icon size={18} className="group-hover:scale-105 smooth-transition">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </Icon>
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
