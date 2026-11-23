import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WelcomePageView } from '../../utils/welcomePageView';

/** Accounts that are not new (or skipped the welcome screen) go home. */
export function useWelcomePageEffects(view: WelcomePageView): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (view.type === 'leave') {
      navigate('/', { replace: true });
    }
  }, [navigate, view.type]);
}
