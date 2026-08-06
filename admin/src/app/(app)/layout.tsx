import { redirect } from 'next/navigation';
import { AdminShell } from '@admin/components/layout';
import { requireAdminSession } from '@admin/auth/session';

export interface IAppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: IAppLayoutProps) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    redirect('/login');
  }

  return <AdminShell email={session.email}>{children}</AdminShell>;
}
