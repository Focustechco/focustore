'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LoginModal, type CustomerSession } from '@/components/layout/login-modal';

function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  const handleAuthenticated = (_user: CustomerSession) => {
    window.location.assign(returnTo);
  };

  return (
    <LoginModal
      isOpen
      onClose={() => router.replace('/')}
      onAuthenticated={handleAuthenticated}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
