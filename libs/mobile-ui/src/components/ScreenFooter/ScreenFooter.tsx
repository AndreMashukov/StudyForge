import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../../lib/cn';
import type { IScreenFooter } from './IScreenFooter';

export function ScreenFooter({ children, className }: IScreenFooter) {
  return (
    <SafeAreaView
      edges={['bottom']}
      className={cn(
        '-mx-container border-t border-outline-variant bg-surface-lowest p-4',
        className
      )}
    >
      {children}
    </SafeAreaView>
  );
}
