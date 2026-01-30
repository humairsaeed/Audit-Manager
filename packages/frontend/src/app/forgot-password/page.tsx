'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { ShieldCheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormData) => {
    setIsLoading(true);
    try {
      const response = await authApi.forgotPassword(data.email);
      if (response.success) {
        setSubmitted(true);
        toast.success('If an account exists, a reset link has been sent.');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to request password reset.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
            <ShieldCheckIcon className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-white">Audit Management</h1>
          <p className="mt-2 text-primary-200">Password Recovery</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <Link href="/login" className="text-gray-400 hover:text-gray-600">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h2 className="text-2xl font-semibold text-gray-900">Forgot password</h2>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                If an account with that email exists, you will receive a password reset link.
              </p>
              <Link href="/login" className="btn btn-primary w-full">
                Back to sign in
              </Link>
            </div>
          ) : (
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
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn btn-primary py-3 text-base"
              >
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-primary-200">
          Secure access to your organization's audit and compliance data
        </p>
      </div>
    </div>
  );
}
