import { useContext } from 'react';
import { WelcomePageContext } from '../WelcomePageContext';

export function useWelcomePageContext() {
  const context = useContext(WelcomePageContext);
  if (!context) {
    throw new Error('useWelcomePageContext must be used within WelcomePageProvider');
  }
  return context;
}
