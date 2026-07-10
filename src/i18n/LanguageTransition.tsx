import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import i18n, { type AppLanguage, persistLanguage } from './index';

type LanguageTransitionContextValue = {
  /** Smoothly cross-fades the whole app while the language switches. */
  changeLanguage: (lang: AppLanguage) => void;
};

const LanguageTransitionContext = createContext<LanguageTransitionContextValue | null>(null);

const FADE_OUT_MS = 180;
const FADE_IN_MS = 240;

export function LanguageTransitionProvider({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(1);

  const applyLanguage = useCallback((lang: AppLanguage) => {
    void i18n.changeLanguage(lang);
    void persistLanguage(lang);
  }, []);

  const changeLanguage = useCallback(
    (lang: AppLanguage) => {
      if (lang === i18n.language) return;
      opacity.value = withTiming(
        0,
        { duration: FADE_OUT_MS, easing: Easing.out(Easing.quad) },
        (finished) => {
          'worklet';
          if (finished) {
            runOnJS(applyLanguage)(lang);
            opacity.value = withTiming(1, {
              duration: FADE_IN_MS,
              easing: Easing.in(Easing.quad),
            });
          }
        },
      );
    },
    [applyLanguage, opacity],
  );

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const value = useMemo(() => ({ changeLanguage }), [changeLanguage]);

  return (
    <LanguageTransitionContext.Provider value={value}>
      <Animated.View style={[styles.fill, animatedStyle]}>{children}</Animated.View>
    </LanguageTransitionContext.Provider>
  );
}

export function useLanguageTransition(): LanguageTransitionContextValue {
  const ctx = useContext(LanguageTransitionContext);
  if (!ctx) {
    throw new Error('useLanguageTransition must be used inside LanguageTransitionProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
