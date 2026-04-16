import React from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggle } from '../ThemeToggle';
import { IMainLayout } from './IMainLayout';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { Spinner } from '../ui/Spinner';
import { toggleSidebar } from '../../store/slices/uiSlice';

export const MainLayout: React.FC<IMainLayout> = ({ children }) => {
  const { loading } = useAuth();
  const { isAppFullscreen } = useAppFullscreen();
  const dispatch = useDispatch();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" variant="muted" className="mx-auto" />
          <p className="mt-4 text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background text-foreground">
      {/* Minimal Top Bar — 100% viewport, hidden during app fullscreen */}
      {!isAppFullscreen && (
        <header className="linear-glass border-b border-border/30 w-full flex-shrink-0 z-[1100]">
          <div className="px-4">
            <div className="flex items-center justify-between h-12">
              {/* Burger menu + Logo */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => dispatch(toggleSidebar())}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Toggle sidebar"
                >
                  <Menu size={18} />
                </button>
                <Link
                  to="/"
                  aria-label="AI Learning Assistant"
                  className="flex items-center hover:opacity-80 linear-transition"
                >
                  <span className="text-sm font-semibold text-foreground tracking-tight app-title-responsive">
                    AI Learning Assistant
                  </span>
                </Link>
              </div>

              {/* Right side: theme toggle */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content area (sidebar + page rendered by Page component) */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
};
