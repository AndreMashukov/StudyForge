import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { Button } from '../ui/Button';
import { AgentPanel } from '../AgentPanel/AgentPanel';
import { useHasOpenModal } from '../ModalVisibility';
import { cn } from '../../lib/utils';

export const GlobalAgentLauncher: React.FC = () => {
  const { user } = useAuth();
  const { isAppFullscreen } = useAppFullscreen();
  const hasOpenModal = useHasOpenModal();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!user || isAppFullscreen || hasOpenModal) {
    return null;
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="icon"
        className={cn(
          'fixed bottom-4 right-4 z-[1150] h-14 w-14 rounded-full shadow-lg',
        )}
        onClick={() => setOpen(true)}
        aria-label="Open StudyForge agent"
      >
        <Bot size={22} />
      </Button>
    );
  }

  return (
    <AgentPanel
      scope="workspace"
      variant="overlay"
      onClose={() => setOpen(false)}
      onMutated={() => {
        // Rule caches are invalidated from AgentPanel action events.
      }}
    />
  );
};
