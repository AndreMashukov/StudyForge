import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '../../contexts/AuthContext';
import { useSignOut } from 'react-firebase-hooks/auth';
import { auth } from '../../config/firebase';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ThemeToggle';
import { IMainLayout } from './IMainLayout';
import { selectSidebarIsOpen, toggleSidebar } from '../../store/slices/uiSlice';
import { Menu } from 'lucide-react';

export const MainLayout: React.FC<IMainLayout> = ({ children }) => {
  const { user, loading } = useAuth();
  const [signOut] = useSignOut(auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const sidebarIsOpen = useSelector(selectSidebarIsOpen);
  
  // Calculate header margin and width based on sidebar state
  const sidebarWidth = sidebarIsOpen ? 200 : 64;
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header 
        className="linear-glass border-b border-border/30 fixed top-0 z-[1100] transition-all duration-300"
        style={{
          marginLeft: isMobile ? '0px' : `${sidebarWidth}px`,
          width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`,
        }}
      >
        <div className="px-6">
          <div className="flex items-center justify-between h-16">
            {/* Mobile Hamburger Menu */}
            {isMobile && user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleSidebar}
                className="mr-2"
              >
                <Menu size={20} />
              </Button>
            )}

            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 hover:opacity-80 linear-transition">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Icon size={16} className="text-primary-foreground">
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
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link 
                to="/" 
                className="text-sm text-muted-foreground hover:text-foreground linear-transition"
              >
                Dashboard
              </Link>
              <Link 
                to="/profile" 
                className="text-sm text-muted-foreground hover:text-foreground linear-transition"
              >
                Profile
              </Link>
            </nav>

            {/* User Menu */}
            {user ? (
              <div className="flex items-center space-x-4">
                {/* Theme Toggle */}
                <ThemeToggle />
                
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-foreground">Welcome back</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center border border-primary/20">
                  <span className="text-primary font-medium text-xs">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                {/* Theme Toggle for non-authenticated users */}
                <ThemeToggle />
                
                <Link 
                  to="/auth" 
                  className="text-sm text-muted-foreground hover:text-foreground linear-transition"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content with Toolbar spacer */}
      <main className="flex-1">
        {/* Toolbar spacer to prevent content hiding under fixed header */}
        <div className="h-16" />
        {children}
      </main>

      {/* Mobile Navigation */}
      {user && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 md:hidden">
          <nav className="linear-glass border border-border/30 rounded-lg px-4 py-2 shadow-xl">
            <ul className="flex space-x-6">
              <li>
                <Link
                  to="/"
                  className="flex items-center space-x-2 text-muted-foreground hover:text-foreground text-sm font-medium linear-transition group"
                >
                  <Icon size={16} className="group-hover:scale-105 linear-transition">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </Icon>
                  <span>Profile</span>
                </Link>
              </li>
              <li>
                {/* Theme Toggle in mobile navigation */}
                <div className="flex items-center">
                  <ThemeToggle />
                </div>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
};