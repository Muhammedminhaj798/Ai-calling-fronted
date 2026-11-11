'use client';
// Protected area: restores the session once and redirects anonymous visitors to /login. The shell and page
// always render (instant navigation needs the segment in the static shell); data hooks stay idle until the
// session is authenticated. The backend remains the authority: every API call is token- and role-checked there.
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Shell } from '@/components/shell';
import { bootstrapSession } from '@/lib/api';
import { useSession } from '@/lib/use-api';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    void bootstrapSession();
  }, []);
  useEffect(() => {
    if (session.status === 'anonymous') router.replace('/login');
  }, [session.status, router]);

  return <Shell user={session.status === 'authenticated' ? session.user : null}>{children}</Shell>;
}
