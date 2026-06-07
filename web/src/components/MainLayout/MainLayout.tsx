import React from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
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
import { toggleSidebar } from '../../store/slices/uiSlice';
import { MascotImage } from '../MascotImage';
import { DirectoryRealtimeBridge } from '../DirectoryRealtimeBridge';

export const MainLayout: React.FC<IMainLayout> = ({ children }) => {
  const { loading } = useAuth();
  const { isAppFullscreen } = useAppFullscreen();
  const dispatch = useDispatch();

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
    <div className="h-screen overflow-hidden flex flex-col bg-background text-foreground">
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

      <main className="flex-1 flex flex-col overflow-hidden">
        <DirectoryRealtimeBridge />
        {children}
      </main>
    </div>
  );
};
