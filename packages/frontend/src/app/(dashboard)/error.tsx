'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    // Log for debugging in development; safe no-op in production logs
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      reset();
    }
  }, [pathname, reset]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-gray-600">
          An unexpected error occurred. You can try again or go back.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => reset()} className="btn btn-secondary">
            Try again
          </button>
          <button
            onClick={() => {
              reset();
              router.back();
            }}
            className="btn btn-primary"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
