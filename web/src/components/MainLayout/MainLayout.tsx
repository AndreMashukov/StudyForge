import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import {
  ThemeToggle,
  TopAppBar,
  TopAppBarBrand,
  TopAppBarBrandContent,
  TopAppBarMenuButton,
} from '@study-forge/ui';
import { useAuth } from '../../contexts/AuthContext';
import { IMainLayout } from './IMainLayout';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { Spinner } from '../ui/Spinner';
import { MascotImage } from '../MascotImage';
import { DirectoryRealtimeBridge } from '../DirectoryRealtimeBridge';
import { prefetchDirectoryTree } from '../../pages/DocumentsPage/utils/prefetchDirectoryContents';
import { useAppDispatch } from '../../hooks/redux';
import { toggleSidebar } from '../../store/slices/uiSlice';

export const MainLayout: React.FC<IMainLayout> = ({ children }) => {
  const { user, loading } = useAuth();
  const { isAppFullscreen } = useAppFullscreen();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (user) {
      prefetchDirectoryTree(dispatch);
    }
  }, [user, dispatch]);

  // The shell uses overflow:hidden on html/body; only inner panes scroll. Focus
  // scroll-into-view on hidden inputs can still move window.scrollY and shift layout.
  useEffect(() => {
    const lockWindowScroll = () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('scroll', lockWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', lockWindowScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <MascotImage
            variant="thinking"
            alt="Forge thinking"
            className="mx-auto mb-4 h-24 w-24"
          />
          <Spinner size="lg" variant="muted" className="mx-auto" />
          <p className="mt-4 text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden overscroll-none bg-background text-foreground">
      <TopAppBar
        hidden={isAppFullscreen}
        start={
          <TopAppBarMenuButton
            onClick={() => dispatch(toggleSidebar())}
            icon={<Menu size={18} />}
            aria-label="Toggle sidebar"
          />
        }
        brand={
          <TopAppBarBrand asChild>
            <Link to="/" aria-label="StudyForge">
              <TopAppBarBrandContent />
            </Link>
          </TopAppBarBrand>
        }
        end={<ThemeToggle />}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DirectoryRealtimeBridge />
        {children}
      </main>
    </div>
  );
};
