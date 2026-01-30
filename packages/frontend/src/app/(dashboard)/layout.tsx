'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bars3Icon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import toast from 'react-hot-toast';
import Sidebar from '@/components/layout/Sidebar';
import { useAuthStore } from '@/stores/auth';
import { authApi, notificationsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    logout,
    setLoading,
    isLoading,
    isHydrated,
    updateActivity,
    checkSessionTimeout
  } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  // Handle sidebar collapse toggle
  const handleToggleCollapse = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
  };

  // Handle session timeout
  const handleSessionTimeout = useCallback(() => {
    logout();
    toast.error('Session expired due to inactivity. Please login again.');
    router.push('/login');
  }, [logout, router]);

  // Check authentication after hydration
  useEffect(() => {
    // Wait for hydration to complete
    if (!isHydrated) return;

    // Check for session timeout first
    if (isAuthenticated && checkSessionTimeout()) {
      handleSessionTimeout();
      return;
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login');
    }
    setLoading(false);
  }, [isHydrated, isAuthenticated, router, setLoading, checkSessionTimeout, handleSessionTimeout]);

  // Track user activity for session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      updateActivity();
    };

    // Update activity on initial load
    updateActivity();

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check session timeout periodically (every minute)
    const intervalId = setInterval(() => {
      if (checkSessionTimeout()) {
        handleSessionTimeout();
      }
    }, 60000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
    };
  }, [isAuthenticated, updateActivity, checkSessionTimeout, handleSessionTimeout]);

  // Fetch unread notifications count
  const { data: notificationData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const response = await notificationsApi.getUnreadCount();
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
    enabled: isAuthenticated,
  });

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      logout();
      toast.success('Logged out successfully');
      router.push('/login');
    }
  };

  // Show loading while hydrating or checking auth
  if (!isHydrated || isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main content area */}
      <div className={clsx(
        'transition-all duration-300',
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}>
        {/* Top header */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-200 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 lg:hidden" aria-hidden="true" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            {/* Page title area */}
            <div className="flex flex-1 items-center">
              {/* This can be used for breadcrumbs or search */}
            </div>

            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Notifications */}
              <button
                type="button"
                className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 relative"
                onClick={() => router.push('/notifications')}
              >
                <span className="sr-only">View notifications</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
                {notificationData?.count > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">
                      {notificationData.count > 9 ? '9+' : notificationData.count}
                    </span>
                  </span>
                )}
              </button>

              {/* Separator */}
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200 dark:lg:bg-gray-700" aria-hidden="true" />

              {/* Profile dropdown */}
              <Menu as="div" className="relative">
                <Menu.Button className="-m-1.5 flex items-center p-1.5">
                  <span className="sr-only">Open user menu</span>
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user?.firstName?.[0]}
                      {user?.lastName?.[0]}
                    </span>
                  </div>
                  <span className="hidden lg:flex lg:items-center">
                    <span className="ml-4 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100" aria-hidden="true">
                      {user?.displayName || `${user?.firstName} ${user?.lastName}`}
                    </span>
                  </span>
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2.5 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 py-2 shadow-lg ring-1 ring-gray-900/5 dark:ring-gray-700 focus:outline-none">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user?.displayName || `${user?.firstName} ${user?.lastName}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {user?.roles?.map((r) => r.displayName).join(', ')}
                      </p>
                    </div>
                    <Menu.Item>
                      {({ active }) => (
                        <a
                          href="/profile"
                          className={`${
                            active ? 'bg-gray-50 dark:bg-gray-700' : ''
                          } flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                        >
                          <UserCircleIcon className="mr-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
                          Profile Settings
                        </a>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={`${
                            active ? 'bg-gray-50 dark:bg-gray-700' : ''
                          } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                        >
                          <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
                          Sign out
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
