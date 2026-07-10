import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import kk from './locales/kk.json';
import ru from './locales/ru.json';

export const SUPPORTED_LANGUAGES = ['kk', 'ru', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'streekfit.language';

function detectSystemLanguage(): AppLanguage {
  for (const locale of getLocales()) {
    const code = locale.languageCode;
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as AppLanguage;
    }
  }
  return 'en';
}

export async function loadStoredLanguage(): Promise<AppLanguage | null> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)
    ? (stored as AppLanguage)
    : null;
}

export async function persistLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export async function initI18n(): Promise<typeof i18n> {
  const stored = await loadStoredLanguage();

  // eslint-disable-next-line import/no-named-as-default-member -- fluent i18next API
  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      kk: { translation: kk },
    },
    lng: stored ?? detectSystemLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  return i18n;
}

export default i18n;
