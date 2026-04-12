import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui/Icon';
import { ThemeToggle } from '../ThemeToggle';
import { IMainLayout } from './IMainLayout';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { Spinner } from '../ui/Spinner';

export const MainLayout: React.FC<IMainLayout> = ({ children }) => {
  const { loading } = useAuth();
  const { isAppFullscreen } = useAppFullscreen();

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
              {/* Logo */}
              <Link
                to="/"
                aria-label="AI Learning Assistant"
                className="flex items-center gap-2.5 hover:opacity-80 linear-transition"
              >
                <div className="w-7 h-7 shrink-0 bg-primary rounded-md flex items-center justify-center">
                  <Icon size={14} className="text-primary-foreground">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </Icon>
                </div>
                <span className="text-sm font-semibold text-foreground tracking-tight app-title-responsive">
                  AI Learning Assistant
                </span>
              </Link>

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
