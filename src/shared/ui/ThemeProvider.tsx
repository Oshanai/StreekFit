import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { palette, type ThemeColors, type ThemeName } from './tokens';

type ThemeContextValue = {
  theme: ThemeName;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: palette.dark,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  // Dark-first: default to dark unless the system explicitly asks for light.
  const theme: ThemeName = scheme === 'light' ? 'light' : 'dark';

  const value = useMemo(() => ({ theme, colors: palette[theme] }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
