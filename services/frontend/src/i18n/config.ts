import en from '../messages/en.json';
import es from '../messages/es.json';
import fr from '../messages/fr.json';

export const locales = ['en', 'es', 'fr'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const messages = {
  en,
  es,
  fr,
} as const;

export type Messages = (typeof messages)[Locale];
