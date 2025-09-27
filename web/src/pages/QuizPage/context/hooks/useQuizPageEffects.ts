import { useEffect } from 'react';

export const useQuizPageEffects = () => {

  // Keyboard navigation effect (manages its own dependencies)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Allow keyboard navigation
      if (event.key >= '1' && event.key <= '9') {
        const answerIndex = parseInt(event.key) - 1;
        // This would need to be connected to handlers via custom events or Redux
        console.log(`Keyboard shortcut for answer ${answerIndex}`);
      }
      
      if (event.key === 'Enter') {
        // Submit answer or go to next question
        console.log('Enter pressed - could dispatch Redux action');
      }
      
      if (event.key === 'Escape') {
        // Maybe exit quiz or show menu
        console.log('Escape pressed - could navigate away');
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