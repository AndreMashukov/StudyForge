'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';

export interface IAdminHeaderProps {
  email?: string;
}

export function AdminHeader({ email }: IAdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="text-foreground">{email ?? 'admin'}</span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleLogout}
        aria-label="Sign out"
      >
        <LogOut className="mr-2 h-4 w-4" aria-hidden />
        Sign out
      </Button>
    </header>
  );
}
