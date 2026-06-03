import './globals.css';

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
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
