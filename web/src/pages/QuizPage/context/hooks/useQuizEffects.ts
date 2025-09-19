import { useEffect } from 'react';
import { IQuizEffects } from '../../types/IQuizHandlers';

export const useQuizEffects = ({
  onQuizStart,
  onQuestionChange,
  onAnswerSubmit,
  onQuizComplete,
  onTimeUpdate,
}: IQuizEffects) => {
  
  // Quiz start effect
  useEffect(() => {
    if (onQuizStart) {
      onQuizStart();
    }
  }, [onQuizStart]);

  // Timer effect for tracking time
  useEffect(() => {
    if (onTimeUpdate) {
      const timer = setInterval(() => {
        onTimeUpdate(Date.now());
      }, 1000); // Update every second

      return () => clearInterval(timer);
    }
  }, [onTimeUpdate]);

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Allow keyboard navigation
      if (event.key >= '1' && event.key <= '9') {
        const answerIndex = parseInt(event.key) - 1;
        // This would need to be connected to handlers
        console.log(`Keyboard shortcut for answer ${answerIndex}`);
      }
      
      if (event.key === 'Enter') {
        // Submit answer or go to next question
        console.log('Enter pressed');
      }
      
      if (event.key === 'Escape') {
        // Maybe exit quiz or show menu
        console.log('Escape pressed');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // Page visibility effect (pause/resume quiz when tab changes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Quiz paused - tab not visible');
      } else {
        console.log('Quiz resumed - tab visible');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = 'Are you sure you want to leave? Your quiz progress will be lost.';
      return 'Are you sure you want to leave? Your quiz progress will be lost.';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
};