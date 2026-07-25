import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { palette, type ThemeColors, type ThemeName } from './tokens';

/** Explicit theme picks only — dark IS the default («как в системе» removed). */
export type ThemeMode = ThemeName;

type ThemeContextValue = {
  theme: ThemeName;
  colors: ThemeColors;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: palette.dark,
  mode: 'dark',
  setMode: () => {},
});

const STORAGE_KEY = 'streekfit.themeMode.v1';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light' || stored === 'violet') {
        setModeState(stored);
      }
      // legacy 'system' (or nothing) → dark-first default
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(() => ({ theme: mode, colors: palette[mode], mode, setMode }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
