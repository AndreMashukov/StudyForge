import { useSyncExternalStore } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

let wired = false;

/** Drive TanStack's online state from NetInfo so queries pause (and serve cache) offline. */
export function wireOnlineManager(): void {
  if (wired) return;
  wired = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      );
    }),
  );
}

export function isOnline(): boolean {
  return onlineManager.isOnline();
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}

export const OFFLINE_MESSAGE = "You're offline. Reconnect to use this.";
