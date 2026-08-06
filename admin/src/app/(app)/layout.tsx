import { redirect } from 'next/navigation';
import { AdminShell } from '@admin/components/layout';
import { requireAdminSession } from '@admin/auth/session';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    redirect('/login');
  }

  return <AdminShell email={session.email}>{children}</AdminShell>;
}
