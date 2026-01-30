'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline';
import { useThemeStore, colorPresets, type ThemeMode } from '@/stores/theme';
import clsx from 'clsx';

const themeModes: { value: ThemeMode; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: ComputerDesktopIcon },
];

export function ThemeToggle() {
  const { mode, colorPreset, setMode, setColorPreset, isHydrated } = useThemeStore();

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

          {/* Color Preset Section */}
          <div className="px-4 py-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <SwatchIcon className="h-3.5 w-3.5" />
              Accent Color
            </p>
            <div className="grid grid-cols-4 gap-2">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setColorPreset(preset.value)}
                  className={clsx(
                    'group flex flex-col items-center gap-1 p-2 rounded-md transition-colors',
                    colorPreset === preset.value
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )}
                  title={preset.name}
                >
                  <div
                    className={clsx(
                      'h-6 w-6 rounded-full ring-2 ring-offset-2 dark:ring-offset-gray-800 transition-all',
                      colorPreset === preset.value
                        ? 'ring-gray-400 dark:ring-gray-500'
                        : 'ring-transparent group-hover:ring-gray-200 dark:group-hover:ring-gray-600'
                    )}
                    style={{ backgroundColor: preset.colors[500] }}
                  />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
