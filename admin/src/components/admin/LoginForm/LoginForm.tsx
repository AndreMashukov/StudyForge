'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '../../../lib/firebase/client';
import { Button, Input, Label } from '@study-forge/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import {
  loginFormDefaultValues,
  loginFormSchema,
  type ILoginFormValues,
} from './LoginForm.form';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'submitting' | 'redirecting'
  >('idle');

  const form = useForm<ILoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: loginFormDefaultValues,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const handleValidSubmit = async (values: ILoginFormValues) => {
    setError(null);
    setSubmitStatus('submitting');

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const idToken = await credential.user.getIdToken();

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        if (response.status === 403) {
          setSubmitStatus('redirecting');
          router.push('/unauthorized');
          return;
        }
        throw new Error(payload.message || 'Failed to create admin session');
      }

      const from = searchParams.get('from') || '/';
      setSubmitStatus('redirecting');
      router.push(from);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Sign in failed. Check your credentials.';
      setError(message);
      setSubmitStatus('idle');
    }
  };

  const isSubmitting = submitStatus !== 'idle';
  const submitLabel =
    submitStatus === 'redirecting' ? 'Redirecting…' : 'Signing in…';

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Admin sign in</CardTitle>
        <CardDescription>
          Use an account with the custom claim role set to admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleValidSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? 'true' : 'false'}
              {...register('email')}
            />
            {errors.email ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              {...register('password')}
            />
            {errors.password ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.password.message}
              </p>
            ) : null}
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? submitLabel : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
