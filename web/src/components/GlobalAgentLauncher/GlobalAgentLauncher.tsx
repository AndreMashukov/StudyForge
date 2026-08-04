import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { Button } from '../ui/Button';
import { AgentPanel, useAgentDirectoryContext } from '../AgentPanel/AgentPanel';
import { cn } from '../../lib/utils';

export const GlobalAgentLauncher: React.FC = () => {
  const { user } = useAuth();
  const { isAppFullscreen } = useAppFullscreen();
  const directoryId = useAgentDirectoryContext();
  const [open, setOpen] = useState(false);

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
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[1140] bg-black/40"
            aria-label="Close agent backdrop"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-4 right-4 z-[1150] flex h-[min(720px,calc(100vh-2rem))] w-[min(420px,calc(100vw-2rem))] flex-col">
            <AgentPanel
              scope="workspace"
              directoryId={directoryId}
              variant="overlay"
              defaultExpanded
              onClose={() => setOpen(false)}
              onMutated={() => {
                // Directory tree and contents refresh through existing RTK invalidations
                // triggered by delete/create mutations in proposal cards and tool actions.
              }}
            />
          </div>
        </>
      ) : null}
    </>
  );
};
