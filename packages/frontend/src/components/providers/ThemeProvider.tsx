'use client';

import { useEffect, useState } from 'react';
import { useThemeStore, getColorPreset } from '@/stores/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, colorPreset, isHydrated } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  // Apply theme mode (light/dark)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isHydrated) return;

    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(mode === 'dark');
    }
  }, [mode, mounted, isHydrated]);

  // Apply color preset
  useEffect(() => {
    if (!mounted || !isHydrated) return;

    const preset = getColorPreset(colorPreset);
    const root = document.documentElement;

    // Set CSS custom properties for the primary color
    Object.entries(preset.colors).forEach(([shade, color]) => {
      root.style.setProperty(`--color-primary-${shade}`, color);
    });
  }, [colorPreset, mounted, isHydrated]);

  return <>{children}</>;
}
