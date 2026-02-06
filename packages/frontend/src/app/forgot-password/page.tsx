'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import {
  ShieldCheckIcon,
  ArrowLeftIcon,
  LockClosedIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  ServerStackIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormData) => {
    setIsLoading(true);
    setFormError(null);
    try {
      const response = await authApi.forgotPassword(data.email);
      if (response.success) {
        setSubmitted(true);
        toast.success('If an account exists, a reset link has been sent.');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to request password reset.';
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
                className="h-12 w-auto"
              />
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 ring-1 ring-slate-800 shadow-lg">
                  <ShieldCheckIcon className="h-5 w-5 text-primary-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wide text-white">ERES AMS</p>
                  <p className="text-xs text-slate-400">Audit & Compliance Platform</p>
                </div>
              </div>
            </div>

            {/* Main headline */}
            <div className="mt-10 space-y-4">
              <h1 className="text-3xl font-semibold leading-tight text-white lg:text-4xl">
                Password Recovery
              </h1>
              <p className="text-base text-slate-300 leading-relaxed max-w-md">
                Reset your password securely. We'll send a verification link to your registered email address.
              </p>
            </div>

            {/* How it works */}
            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                How it works
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-slate-900/50 px-4 py-3 ring-1 ring-slate-800/50">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500/20 text-sm font-medium text-primary-400">
                    1
                  </div>
                  <span className="text-sm text-slate-300">Enter your registered email address</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-slate-900/50 px-4 py-3 ring-1 ring-slate-800/50">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500/20 text-sm font-medium text-primary-400">
                    2
                  </div>
                  <span className="text-sm text-slate-300">Check your inbox for the reset link</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-slate-900/50 px-4 py-3 ring-1 ring-slate-800/50">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500/20 text-sm font-medium text-primary-400">
                    3
                  </div>
                  <span className="text-sm text-slate-300">Create a new secure password</span>
                </div>
              </div>
            </div>

            {/* Security note */}
            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                Security & Compliance
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                    <LockClosedIcon className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-slate-400">Reset links expire after 1 hour</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                    <FingerPrintIcon className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-slate-400">All password changes are logged</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                    <ServerStackIcon className="h-4 w-4 text-green-400" />
                  </div>
                  <span className="text-sm text-slate-400">Encrypted transmission</span>
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
                  Account Recovery
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Reset your password
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              {/* Form error summary */}
              {formError && (
                <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 ring-1 ring-red-200 dark:ring-red-800">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">
                        Request failed
                      </p>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-400">{formError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Card */}
              <div className="card p-8">
                {submitted ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <EnvelopeIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Check your email
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        If an account with that email exists, you will receive a password reset link shortly.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Link href="/login" className="btn btn-primary w-full py-3 text-base">
                        Back to sign in
                      </Link>
                      <button
                        type="button"
                        onClick={() => setSubmitted(false)}
                        className="btn btn-secondary w-full"
                      >
                        Try another email
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-6">
                      <Link
                        href="/login"
                        className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                      >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to sign in
                      </Link>
                    </div>

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
                            Sending...
                          </span>
                        ) : (
                          'Send reset link'
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>

              {/* Help section */}
              <div className="mt-6 rounded-lg bg-slate-100 dark:bg-slate-900 p-4">
                <div className="flex items-start gap-3">
                  <QuestionMarkCircleIcon className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-700 dark:text-slate-300">Need help?</p>
                    <div className="mt-1.5 space-y-1 text-slate-500 dark:text-slate-400">
                      <p>
                        Don't have access to your email?{' '}
                        <a
                          href="mailto:support@eresams.com"
                          className="text-primary-600 hover:text-primary-500 dark:text-primary-400"
                        >
                          Contact IT Support
                        </a>
                      </p>
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
