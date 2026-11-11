'use client';
import { Pill } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { bootstrapSession, login } from '@/lib/api';
import { useAction, useSession } from '@/lib/use-api';

export default function LoginPage() {
  const router = useRouter();
  const session = useSession();
  const action = useAction(login);

  useEffect(() => {
    void bootstrapSession();
  }, []);
  useEffect(() => {
    if (session.status === 'authenticated') router.replace('/dashboard');
  }, [session.status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <form
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const user = await action.run(String(data.get('email')), String(data.get('password')));
          if (user) router.replace('/dashboard');
        }}
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
            <Pill className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Pharmacy AI Operations</h1>
            <p className="text-xs text-slate-500">Staff sign-in</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Email">
            <Input name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required minLength={8} />
          </Field>
          {action.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {action.error.status === 429 ? 'Too many attempts. Try again in a few minutes.' : action.error.message}
            </p>
          )}
          <Button type="submit" variant="primary" loading={action.pending} className="mt-1 w-full">
            Sign in
          </Button>
        </div>
      </form>
    </div>
  );
}
