'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  UserCircleIcon,
  KeyIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/auth';
import { authApi, usersApi } from '@/lib/api';
import clsx from 'clsx';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  displayName: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      displayName: user?.displayName || '',
      department: user?.department || '',
      title: user?.title || '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!user?.id) throw new Error('User not found');
      return usersApi.update(user.id, data);
    },
    onSuccess: (response) => {
      const updatedUser = response.data?.user;
      if (updatedUser && user) {
        setUser({
          ...user,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          displayName: updatedUser.displayName,
          department: updatedUser.department,
          title: updatedUser.title,
        });
      }
      toast.success('Profile updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    },
  });

  const { data: avatarData } = useQuery({
    queryKey: ['profile-avatar', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await usersApi.getAvatar(user.id);
      return response.data?.url ?? null;
    },
    enabled: !!user?.id,
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('User not found');
      return usersApi.uploadAvatar(user.id, file);
    },
    onSuccess: (response) => {
      const url = response.data?.url;
      if (user) {
        setUser({ ...user, avatarUrl: url || null });
      }
      toast.success('Profile photo updated');
      setAvatarFile(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to upload profile photo');
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not found');
      return usersApi.deleteAvatar(user.id);
    },
    onSuccess: () => {
      if (user) {
        setUser({ ...user, avatarUrl: null, avatar: undefined });
      }
      toast.success('Profile photo removed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove profile photo');
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      return authApi.changePassword(data.currentPassword, data.newPassword);
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      resetPassword();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to change password');
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  const avatarUrl = user?.avatarUrl ?? avatarData ?? null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-white">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {user?.displayName || `${user?.firstName} ${user?.lastName}`}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">{user?.email}</p>
            <div className="mt-3 flex items-center gap-2">
              <label className="btn btn-secondary btn-sm cursor-pointer">
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                type="button"
                onClick={() => avatarFile && uploadAvatarMutation.mutate(avatarFile)}
                disabled={!avatarFile || uploadAvatarMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                {uploadAvatarMutation.isPending ? 'Uploading...' : 'Save Photo'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => deleteAvatarMutation.mutate()}
                  disabled={deleteAvatarMutation.isPending}
                  className="btn btn-secondary btn-sm text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {user?.roles?.map((role) => (
                <span
                  key={role.id}
                  className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 rounded"
                >
                  {role.displayName}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={clsx(
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'profile'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
            )}
          >
            <UserCircleIcon className="h-5 w-5 inline-block mr-2" />
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={clsx(
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'security'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-600'
            )}
          >
            <KeyIcon className="h-5 w-5 inline-block mr-2" />
            Security
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Personal Information
          </h3>
          <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input
                  type="text"
                  {...registerProfile('firstName')}
                  className="input"
                />
                {profileErrors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{profileErrors.firstName.message}</p>
                )}
              </div>

              <div>
                <label className="label">Last Name *</label>
                <input
                  type="text"
                  {...registerProfile('lastName')}
                  className="input"
                />
                {profileErrors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{profileErrors.lastName.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="label">Display Name</label>
                <input
                  type="text"
                  {...registerProfile('displayName')}
                  className="input"
                  placeholder="How you want to be displayed"
                />
              </div>

              <div>
                <label className="label">
                  <BuildingOfficeIcon className="h-4 w-4 inline-block mr-1" />
                  Department
                </label>
                <input
                  type="text"
                  {...registerProfile('department')}
                  className="input"
                  placeholder="e.g., Internal Audit"
                />
              </div>

              <div>
                <label className="label">
                  <BriefcaseIcon className="h-4 w-4 inline-block mr-1" />
                  Job Title
                </label>
                <input
                  type="text"
                  {...registerProfile('title')}
                  className="input"
                  placeholder="e.g., Senior Auditor"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="btn btn-primary"
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Read-only info */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-4">Account Information</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <EnvelopeIcon className="h-5 w-5 text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Email:</span>
                <span className="text-slate-900 dark:text-white">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Change Password
          </h3>
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
            <div>
              <label className="label">Current Password *</label>
              <input
                type="password"
                {...registerPassword('currentPassword')}
                className="input"
                placeholder="Enter your current password"
              />
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label className="label">New Password *</label>
              <input
                type="password"
                {...registerPassword('newPassword')}
                className="input"
                placeholder="Enter your new password"
              />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword.message}</p>
              )}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Password must be at least 8 characters long
              </p>
            </div>

            <div>
              <label className="label">Confirm New Password *</label>
              <input
                type="password"
                {...registerPassword('confirmPassword')}
                className="input"
                placeholder="Confirm your new password"
              />
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="btn btn-primary"
              >
                {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

