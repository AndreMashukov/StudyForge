import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { Button } from '../ui/Button';
import { AgentPanel, useAgentDirectoryContext } from '../AgentPanel/AgentPanel';
import { cn } from '../../lib/utils';

export const GlobalAgentLauncher: React.FC = () => {
  const { user } = useAuth();
  const { isAppFullscreen } = useAppFullscreen();
  const location = useLocation();
  const directoryId = useAgentDirectoryContext();
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

  if (!user || isAppFullscreen) {
    return null;
  }

  return (
    <>
      {!open ? (
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
      ) : (
        <AgentPanel
          scope="workspace"
          directoryId={directoryId}
          variant="overlay"
          onClose={() => setOpen(false)}
          onMutated={() => {
            // Directory tree and contents refresh through existing RTK invalidations
            // triggered by delete/create mutations in proposal cards and tool actions.
          }}
        />
      )}
    </>
  );
};
