'use client';

import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useThemeStore } from '@/stores/theme';

export function ThemeToggle() {
  const { mode, setMode, isHydrated } = useThemeStore();

  if (!isHydrated) {
    return (
      <div className="h-6 w-6 animate-pulse bg-slate-200 dark:bg-slate-700 rounded" />
    );
  }

  const isDark = mode === 'dark';

  return (
    <button
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-300 dark:hover:text-white"
      aria-label="Toggle theme"
    >
      {isDark ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
    </button>
  );
}
