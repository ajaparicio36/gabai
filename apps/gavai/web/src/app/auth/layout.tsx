'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { type ReactNode } from 'react';

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/map');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-secondary to-primary p-4">
      {children}
    </div>
  );
}
