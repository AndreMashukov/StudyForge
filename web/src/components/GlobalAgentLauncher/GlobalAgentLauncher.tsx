import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { Button } from '../ui/Button';
import { AgentPanel } from '../AgentPanel/AgentPanel';
import { useHasOpenModal } from '../ModalVisibility';
import { cn } from '../../lib/utils';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  selectAgentLauncherDraft,
  selectAgentLauncherThread,
  setAgentLauncherDraft,
  setAgentLauncherThread,
} from '../../store/slices/uiSlice';
import { WELCOME_PATH } from '../../utils/onboardingRedirect';

export const GlobalAgentLauncher: React.FC = () => {
  const { user } = useAuth();
  const { isAppFullscreen } = useAppFullscreen();
  const hasOpenModal = useHasOpenModal();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const draft = useAppSelector(selectAgentLauncherDraft);
  const requestedThread = useAppSelector(selectAgentLauncherThread);
  // The thread the open panel was mounted with (kept while it stays open).
  const [panelThread, setPanelThread] = useState<{ threadId: string | null }>();
  // Bumped per request so asking again for the shown thread still remounts.
  const [panelThreadRequest, setPanelThreadRequest] = useState(0);
  const panelVisible = Boolean(user) && !isAppFullscreen && !hasOpenModal && open;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  // A draft (e.g. "Ask StudyForge" in library search) opens the panel with it prefilled.
  useEffect(() => {
    if (draft !== null) {
      setOpen(true);
    }
  }, [draft]);

  // A folder's Chats tab asks to show a thread (or a new chat): remount the
  // panel on it, then spend the request.
  useEffect(() => {
    if (requestedThread === null) {
      return;
    }
    setPanelThread(requestedThread);
    setPanelThreadRequest((count) => count + 1);
    setOpen(true);
    dispatch(setAgentLauncherThread(null));
  }, [requestedThread, dispatch]);

  useEffect(() => {
    if (!open) {
      setPanelThread(undefined);
    }
  }, [open]);

  // The panel reads the draft once when it mounts; after that it is spent.
  useEffect(() => {
    if (draft !== null && panelVisible) {
      dispatch(setAgentLauncherDraft(null));
    }
  }, [draft, panelVisible, dispatch]);

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

  // The welcome screen has its own agent conversation.
  if (!user || isAppFullscreen || hasOpenModal || location.pathname === WELCOME_PATH) {
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
      key={panelThread ? `request:${panelThreadRequest}` : 'remembered'}
      scope="workspace"
      variant="overlay"
      initialInput={draft ?? undefined}
      initialThread={panelThread}
      onClose={() => setOpen(false)}
      onMutated={() => {
        // Rule caches are invalidated from AgentPanel action events.
      }}
    />
  );
};
