import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { palette, type ThemeColors, type ThemeName } from './tokens';

/** 'system' follows the OS (dark-first); the rest are explicit picks. */
export type ThemeMode = 'system' | ThemeName;

type ThemeContextValue = {
  theme: ThemeName;
  colors: ThemeColors;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: palette.dark,
  mode: 'system',
  setMode: () => {},
});

const STORAGE_KEY = 'streekfit.themeMode.v1';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light' || stored === 'violet' || stored === 'system') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  // Dark-first: system mode falls back to dark unless the OS asks for light.
  const theme: ThemeName = mode === 'system' ? (scheme === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo(() => ({ theme, colors: palette[theme], mode, setMode }), [theme, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
