'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  DocumentCheckIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  ServerStackIcon,
  FingerPrintIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Feature to toggle SSO visibility via environment or config
const SSO_ENABLED = false; // Set to true when SSO is configured

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Caps Lock detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.getModifierState) {
        setCapsLockOn(e.getModifierState('CapsLock'));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.getModifierState) {
        setCapsLockOn(e.getModifierState('CapsLock'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setFormError(null);
    try {
      const response = await authApi.login(data.email, data.password);

      if (response.success && response.data) {
        const { user, tokens } = response.data;
        login(user, tokens.accessToken, tokens.refreshToken);

        toast.success('Login successful!');

        // Check if user needs to change password
        if (user.mustChangePassword) {
          router.push('/change-password');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel - Full height dark background */}
      <div className="relative w-full lg:w-1/2 bg-slate-950">
        <div className="relative flex min-h-screen flex-col justify-between px-8 py-10 text-slate-100 lg:px-12 xl:px-16 overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 via-transparent to-primary-400/5" />

          <div className="relative z-10">
            {/* Logo and brand */}
            <div>
              <img
                src="/logo-eres-white.svg"
                alt="ERES EMIRATES REAL ESTATE SOLUTIONS"
                className="h-16 w-auto"
              />
              <p className="mt-2 text-sm text-slate-400">Audit & Compliance Platform</p>
            </div>

            {/* Main headline */}
            <div className="mt-10 space-y-4">
              <h1 className="text-3xl font-semibold leading-tight text-white lg:text-4xl">
                Secure access for regulated audit teams
              </h1>
              <p className="text-base text-slate-300 leading-relaxed max-w-md">
                Centralize audits, observations, evidence, and approvals with a
                defensible, traceable workflow.
              </p>
            </div>

            {/* What you can do - Capabilities */}
            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                What you can do
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 rounded-lg bg-slate-900/50 px-3 py-2.5 ring-1 ring-slate-800/50">
                  <DocumentCheckIcon className="h-4 w-4 text-primary-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Track observations</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-slate-900/50 px-3 py-2.5 ring-1 ring-slate-800/50">
                  <ClipboardDocumentCheckIcon className="h-4 w-4 text-primary-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Collect evidence</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-slate-900/50 px-3 py-2.5 ring-1 ring-slate-800/50">
                  <CheckBadgeIcon className="h-4 w-4 text-primary-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Approve remediation</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg bg-slate-900/50 px-3 py-2.5 ring-1 ring-slate-800/50">
                  <ChartBarIcon className="h-4 w-4 text-primary-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Monitor SLA compliance</span>
                </div>
              </div>
            </div>

            {/* Trust indicators */}
            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                Security & Compliance
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                    <CheckCircleIcon className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-slate-400">SOC2 / ISO 27001 aligned workflows</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                    <LockClosedIcon className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-slate-400">Encryption in transit & at rest</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                    <FingerPrintIcon className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-slate-400">Activity logs retained for audit trail</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                    <ServerStackIcon className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-slate-400">Role-based access controls</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 mt-10 flex items-center justify-between text-xs text-slate-500">
            <span>© {new Date().getFullYear()} ERES AMS. All rights reserved.</span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="w-full lg:w-1/2 bg-slate-50 dark:bg-slate-950">
        <div className="flex min-h-screen flex-col justify-between px-6 py-10 lg:px-12 xl:px-16">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              {/* Header */}
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Secure Login
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Sign in to your account
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Authorized users only. All access is monitored and logged.
                </p>
              </div>

              {/* Form error summary */}
              {formError && (
                <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 ring-1 ring-red-200 dark:ring-red-800">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">
                        Authentication failed
                      </p>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-400">{formError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Login card */}
              <div className="card p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="label">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      {...register('email')}
                      className={`input ${errors.email ? 'input-error' : ''}`}
                      placeholder="you@company.com"
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="label">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        {...register('password')}
                        className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        {errors.password.message}
                      </p>
                    )}
                    {capsLockOn && (
                      <p className="mt-1.5 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        Caps Lock is on
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800"
                      />
                      <label
                        htmlFor="remember-me"
                        className="text-sm text-slate-700 dark:text-slate-300"
                        title="Keep me signed in on this device"
                      >
                        Remember me
                      </label>
                    </div>

                    <a
                      href="/forgot-password"
                      className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      Forgot password?
                    </a>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn btn-primary py-3 text-base"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Signing in...
                      </span>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>

                {/* SSO Section - Improved */}
                {SSO_ENABLED ? (
                  <div className="mt-6">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">
                          Or continue with
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-4 w-full btn btn-secondary"
                    >
                      <ServerStackIcon className="h-5 w-5 mr-2" />
                      Sign in with SSO
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Help section */}
              <div className="mt-6 rounded-lg bg-slate-100 dark:bg-slate-900 p-4">
                <div className="flex items-start gap-3">
                  <QuestionMarkCircleIcon className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-700 dark:text-slate-300">Need help?</p>
                    <div className="mt-1.5 space-y-1 text-slate-500 dark:text-slate-400">
                      <a
                        href="/forgot-password"
                        className="block hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        Having trouble signing in?
                      </a>
                      <a
                        href="mailto:support@eresams.com"
                        className="block hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        Contact IT Support
                      </a>
                      {!SSO_ENABLED && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
                          <span className="inline-flex items-center gap-1">
                            <ServerStackIcon className="h-3.5 w-3.5" />
                            SSO available for Enterprise
                          </span>
                          {' — '}
                          <a
                            href="mailto:admin@eresams.com"
                            className="hover:text-primary-600 dark:hover:text-primary-400"
                          >
                            Contact admin to enable
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel footer */}
          <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-4">
                <a href="/privacy" className="hover:text-primary-600 dark:hover:text-primary-400">
                  Privacy Policy
                </a>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <a href="/terms" className="hover:text-primary-600 dark:hover:text-primary-400">
                  Terms of Service
                </a>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <LockClosedIcon className="h-3.5 w-3.5" />
                  Authorized use only
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>This system is monitored</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
