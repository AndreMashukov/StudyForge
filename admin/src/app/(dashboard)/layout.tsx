import { redirect } from 'next/navigation';
import { AdminShell } from '../../components/admin/AdminShell';
import { requireAdminSession } from '../../lib/auth/session';

export default async function DashboardLayout({
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

  return (
    <AdminShell email={session.email}>{children}</AdminShell>
  );
}
