import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeName = 'current' | 'dark' | 'studyplus' | 'screenshot';

export interface ThemeOption {
  id: ThemeName;
  label: string;
  shortLabel: string;
  description: string;
  tone: string;
}

const STORAGE_KEY = 'tzeen-theme';

export const themeOptions: ThemeOption[] = [
  {
    id: 'current',
    label: 'Original',
    shortLabel: '01',
    description: 'The existing quiet TZeen interface with monochrome structure and calm spacing.',
    tone: 'Existing',
  },
  {
    id: 'dark',
    label: 'Dark',
    shortLabel: '02',
    description: 'A sharper black-on-black direction with stronger contrast and premium depth.',
    tone: 'Monochrome',
  },
  {
    id: 'studyplus',
    label: 'Pop',
    shortLabel: '03',
    description: 'A brighter, more motivating learning mode with colorful blocks and habit-friendly cues.',
    tone: 'Playful',
  },
  {
    id: 'screenshot',
    label: 'Bright',
    shortLabel: '04',
    description: 'A softer screenshot-inspired dashboard with airy cards, rounded blocks, and pastel brightness.',
    tone: 'Soft bright',
  },
];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  options: ThemeOption[];
  activeTheme: ThemeOption;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'current';
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (stored && themeOptions.some((option) => option.id === stored)) return stored;
    return 'current';
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      options: themeOptions,
      activeTheme: themeOptions.find((option) => option.id === theme) || themeOptions[0],
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
