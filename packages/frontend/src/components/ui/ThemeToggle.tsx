'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import { useThemeStore, type ThemeMode } from '@/stores/theme';
import clsx from 'clsx';

const themeModes: { value: ThemeMode; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: ComputerDesktopIcon },
];

export function ThemeToggle() {
  const { mode, setMode, isHydrated } = useThemeStore();

  if (!isHydrated) {
    return (
      <div className="h-6 w-6 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
    );
  }

  const CurrentIcon = themeModes.find((t) => t.value === mode)?.icon || SunIcon;

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300">
        <span className="sr-only">Theme settings</span>
        <CurrentIcon className="h-6 w-6" aria-hidden="true" />
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
        <Menu.Items className="absolute right-0 z-10 mt-2.5 w-64 origin-top-right rounded-lg bg-white dark:bg-gray-800 py-2 shadow-lg ring-1 ring-gray-900/5 dark:ring-gray-700 focus:outline-none">
          {/* Theme Mode Section */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Appearance
            </p>
            <div className="flex gap-1">
              {themeModes.map((theme) => {
                const Icon = theme.icon;
                return (
                  <button
                    key={theme.value}
                    onClick={() => setMode(theme.value)}
                    className={clsx(
                      'flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                      mode === theme.value
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {theme.label}
                  </button>
                );
              })}
            </div>
          </div>

        </Menu.Items>
      </Transition>
    </Menu>
  );
}
