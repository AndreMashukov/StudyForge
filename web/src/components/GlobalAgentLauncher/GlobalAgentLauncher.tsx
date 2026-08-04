import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogTrigger } from '../ui/Dialog';
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          className={cn(
            'fixed bottom-4 right-4 z-[1150] h-14 w-14 rounded-full shadow-lg',
            open && 'pointer-events-none opacity-0',
          )}
          aria-label="Open StudyForge agent"
        >
          <Bot size={22} />
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-label="StudyForge agent"
        className={cn(
          'fixed bottom-4 right-4 left-auto top-auto z-[1150] flex h-[min(720px,calc(100vh-2rem))] w-[min(420px,calc(100vw-2rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 border-0 bg-transparent p-0 shadow-none',
          '[&>button]:hidden',
        )}
      >
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
      </DialogContent>
    </Dialog>
  );
};
