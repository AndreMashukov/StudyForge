import './globals.css';
import { AdminThemeProvider } from '@admin/components/layout';

export const metadata = {
  title: 'Study Forge Admin',
  description: 'Internal operator console for Study Forge',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <AdminThemeProvider>{children}</AdminThemeProvider>
      </body>
    </html>
  );
}
