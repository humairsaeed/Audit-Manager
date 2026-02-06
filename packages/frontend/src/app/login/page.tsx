'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
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
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row">
        {/* Left panel */}
        <div className="relative flex w-full flex-col justify-between bg-slate-950 px-8 py-10 text-slate-100 lg:w-5/12 lg:rounded-l-3xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 ring-1 ring-slate-800">
                <ShieldCheckIcon className="h-6 w-6 text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-white">ERES AMS</p>
                <p className="text-xs text-slate-400">Audit & Compliance Platform</p>
              </div>
            </div>

            <div className="mt-10 space-y-4">
              <h1 className="text-2xl font-semibold leading-tight text-white">
                Secure access for regulated audit teams
              </h1>
              <p className="text-sm text-slate-300">
                Centralize audits, observations, evidence, and approvals with a
                defensible, traceable workflow.
              </p>
            </div>

            <div className="mt-10 space-y-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                ISO-aligned evidence tracking
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                Role-based access controls
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                Audit-ready activity logs
              </div>
            </div>
          </div>

          <div className="mt-10 text-xs text-slate-500">
            © {new Date().getFullYear()} ERES AMS. All rights reserved.
          </div>
        </div>

        {/* Right panel */}
        <div className="flex w-full items-center justify-center px-6 py-10 lg:w-7/12 lg:px-12">
          <div className="w-full max-w-md">
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
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
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
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-600 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
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
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  className="w-full btn btn-secondary"
                  disabled
                >
                  Single Sign-On (Coming soon)
                </button>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Use corporate SSO when enabled by your administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
