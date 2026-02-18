'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type FC,
  type PropsWithChildren,
} from 'react';
import {
  locales,
  defaultLocale,
  messages,
  type Locale,
  type Messages,
} from './config';

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return typeof value === 'string' ? value : path;
}

const STORAGE_KEY = 'invincible-voice-locale';

export const I18nProvider: FC<PropsWithChildren> = ({ children = null }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return defaultLocale;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && locales.includes(stored as Locale)) {
      return stored as Locale;
    }

    const browserLang = navigator.language.split('-')[0];
    if (locales.includes(browserLang as Locale)) {
      return browserLang as Locale;
    }

    return defaultLocale;
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string): string =>
      getNestedValue(
        messages[locale] as unknown as Record<string, unknown>,
        key,
      ),
    [locale],
  );

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      messages: messages[locale],
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function useLocale(): Locale {
  const { locale } = useI18n();
  return locale;
}

export function useTranslations(): (key: string) => string {
  const { t } = useI18n();
  return t;
}
