'use client';

import { ThemeProvider } from '@study-forge/ui';

export interface IAdminThemeProviderProps {
  children: React.ReactNode;
}

export function AdminThemeProvider({ children }: IAdminThemeProviderProps) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
