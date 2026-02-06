'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorPreset {
  name: string;
  value: string;
  colors: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
}

export const colorPresets: ColorPreset[] = [
  {
    name: 'Blue',
    value: 'blue',
    colors: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#0f172a',
      700: '#1d2e54',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
  },
  {
    name: 'Green',
    value: 'green',
    colors: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
  },
  {
    name: 'Purple',
    value: 'purple',
    colors: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
      950: '#3b0764',
    },
  },
  {
    name: 'Indigo',
    value: 'indigo',
    colors: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
      950: '#1e1b4b',
    },
  },
  {
    name: 'Teal',
    value: 'teal',
    colors: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e',
    },
  },
  {
    name: 'Rose',
    value: 'rose',
    colors: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337',
      950: '#4c0519',
    },
  },
  {
    name: 'Orange',
    value: 'orange',
    colors: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
      950: '#431407',
    },
  },
  {
    name: 'Cyan',
    value: 'cyan',
    colors: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
      950: '#083344',
    },
  },
];

interface ThemeState {
  mode: ThemeMode;
  colorPreset: string;
  isHydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  setColorPreset: (preset: string) => void;
  toggleMode: () => void;
  getEffectiveMode: () => 'light' | 'dark';
  setHydrated: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      colorPreset: 'blue',
      isHydrated: false,

      setMode: (mode) => set({ mode }),

      setColorPreset: (preset) => set({ colorPreset: preset }),

      toggleMode: () => {
        const currentMode = get().mode;
        if (currentMode === 'light') {
          set({ mode: 'dark' });
        } else if (currentMode === 'dark') {
          set({ mode: 'system' });
        } else {
          set({ mode: 'light' });
        }
      },

      getEffectiveMode: () => {
        const { mode } = get();
        if (mode === 'system') {
          if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          return 'light';
        }
        return mode;
      },

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

// Helper function to get color preset by value
export const getColorPreset = (value: string): ColorPreset => {
  return colorPresets.find((p) => p.value === value) || colorPresets[0];
};



