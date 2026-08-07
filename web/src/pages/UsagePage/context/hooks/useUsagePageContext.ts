import { useContext } from 'react';
import { UsagePageContext } from '../UsagePageContext';

export function useUsagePageContext() {
  const context = useContext(UsagePageContext);
  if (!context) {
    throw new Error('useUsagePageContext must be used within UsagePageProvider');
  }
  return context;
}
