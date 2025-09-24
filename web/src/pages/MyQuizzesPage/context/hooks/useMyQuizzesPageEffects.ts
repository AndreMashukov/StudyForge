import { useEffect } from 'react';

interface UseMyQuizzesPageEffectsProps {
  refetchQuizzes?: () => void;
}

export const useMyQuizzesPageEffects = ({ refetchQuizzes }: UseMyQuizzesPageEffectsProps) => {
  // Auto-refresh on window focus (non-fetch related effect)
  useEffect(() => {
    const handleWindowFocus = () => {
      if (refetchQuizzes) {
        refetchQuizzes();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [refetchQuizzes]);

  // Could add other non-fetch effects here like:
  // - Keyboard shortcuts
  // - Local storage sync
  // - Analytics tracking
  // - Timer-based effects
};