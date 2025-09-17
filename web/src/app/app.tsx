import { Route, Routes, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AuthForm } from '../components/AuthForm';
import { UserProfile } from '../components/UserProfile';
import { Icon } from '../components/ui/icon';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

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
      {/* Linear-style header */}
      <header className="linear-glass border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary/20 rounded-md flex items-center justify-center border border-primary/20">
                <Icon size={16} className="text-primary">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </Icon>
              </div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                Quiz AI Generator
              </h1>
            </div>
            
            {/* Linear-style navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground linear-transition">Product</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground linear-transition">Pricing</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground linear-transition">Docs</a>
            </nav>
            
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-foreground">Welcome back</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center border border-primary/20">
                  <span className="text-primary font-medium text-xs">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <button className="text-sm text-muted-foreground hover:text-foreground linear-transition">
                  Log in
                </button>
                <button className="linear-button px-4 py-1.5 text-sm font-medium text-foreground rounded-md">
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative">
        {!user ? (
          <div className="relative">
            {/* Linear-style hero section */}
            <div className="text-center pt-20 pb-32 px-6">
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Main heading - Linear style */}
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground tracking-tight leading-none">
                  Quiz AI Generator is a purpose-built tool for
                  <span className="block linear-gradient bg-clip-text text-transparent">
                    intelligent assessments
                  </span>
                </h1>
                
                {/* Subtitle */}
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Meet the system for modern education technology. 
                  Transform any web content into engaging, AI-powered quizzes.
                </p>
                
                {/* CTA Buttons - Linear style */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                  <button className="linear-button px-6 py-3 text-sm font-medium text-foreground rounded-lg flex items-center gap-2">
                    Start building
                  </button>
                  <button className="text-sm text-muted-foreground hover:text-foreground linear-transition flex items-center gap-1">
                    New: AI Intelligence
                    <Icon size={14} className="text-muted-foreground">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </Icon>
                  </button>
                </div>
              </div>
            </div>

            {/* Feature preview section */}
            <div className="max-w-6xl mx-auto px-6 pb-20">
              <div className="text-center mb-16">
                <p className="text-sm text-muted-foreground mb-4">
                  Powering the world's best educational teams.
                </p>
                <div className="flex justify-center space-x-8 opacity-50">
                  <div className="w-8 h-8 bg-muted rounded"></div>
                  <div className="w-8 h-8 bg-muted rounded"></div>
                  <div className="w-8 h-8 bg-muted rounded"></div>
                  <div className="w-8 h-8 bg-muted rounded"></div>
                </div>
              </div>
              
              {/* Feature highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto border border-primary/20">
                    <Icon size={20} className="text-primary">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </Icon>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Purpose-built for education</h3>
                </div>
                
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto border border-primary/20">
                    <Icon size={20} className="text-primary">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </Icon>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Designed to move fast</h3>
                </div>
                
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto border border-primary/20">
                    <Icon size={20} className="text-primary">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </Icon>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Crafted to perfection</h3>
                </div>
              </div>
            </div>

            {/* Auth Form Section */}
            <div className="max-w-md mx-auto px-6 pb-20">
              <AuthForm />
            </div>
          </div>
        ) : (
          <div className="min-h-screen">
            <Routes>
              <Route
                path="/"
                element={
                  <div className="max-w-6xl mx-auto px-6 py-16">
                    {/* Linear-style dashboard */}
                    <div className="space-y-12">
                      {/* Dashboard Header */}
                      <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-foreground tracking-tight">
                          Dashboard
                        </h2>
                        <p className="text-muted-foreground max-w-2xl">
                          Transform web content into intelligent quizzes with AI assistance.
                          Start by entering a URL and let our system create engaging questions.
                        </p>
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="linear-glass border border-border/30 linear-glow-hover">
                          <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                                <Icon size={18} className="text-primary">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                </Icon>
                              </div>
                              <Icon size={16} className="text-muted-foreground">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </Icon>
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold text-foreground">Create Quiz</h3>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Generate intelligent quizzes from web content using AI
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="linear-glass border border-border/30 linear-glow-hover">
                          <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                                <Icon size={18} className="text-primary">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                </Icon>
                              </div>
                              <Icon size={16} className="text-muted-foreground">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </Icon>
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold text-foreground">My Quizzes</h3>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Manage and review your created quiz collection
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card className="linear-glass border border-border/30 linear-glow-hover">
                          <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                                <Icon size={18} className="text-primary">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                </Icon>
                              </div>
                              <Icon size={16} className="text-muted-foreground">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </Icon>
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold text-foreground">Analytics</h3>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Track performance and engagement metrics
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Recent Activity */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
                          <button className="text-sm text-muted-foreground hover:text-foreground linear-transition">
                            View all
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="linear-glass border border-border/30 p-4 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">
                                  Welcome to Quiz AI Generator
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Get started by creating your first quiz
                                </p>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Just now
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* User Profile Section */}
                      <div className="pt-8 border-t border-border/30">
                        <UserProfile />
                      </div>
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

            {/* Linear-style bottom navigation */}
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
              <nav className="linear-glass border border-border/30 rounded-lg px-4 py-2 shadow-xl">
                <ul className="flex space-x-6">
                  <li>
                    <Link
                      to="/"
                      className="flex items-center space-x-2 text-muted-foreground hover:text-foreground text-sm font-medium linear-transition group"
                    >
                      <Icon size={16} className="group-hover:scale-105 linear-transition">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0"></path>
                      </Icon>
                      <span>Dashboard</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/profile"
                      className="flex items-center space-x-2 text-muted-foreground hover:text-foreground text-sm font-medium linear-transition group"
                    >
                      <Icon size={16} className="group-hover:scale-105 linear-transition">
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
