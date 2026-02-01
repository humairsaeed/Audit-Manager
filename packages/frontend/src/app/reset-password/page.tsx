import { Suspense } from 'react';
import ResetPasswordClient from './reset-password-client';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
