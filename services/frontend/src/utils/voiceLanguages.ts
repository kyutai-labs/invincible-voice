import type { Locale } from '@/i18n';

/**
 * Languages accepted by the backend for voice cloning (ISO 639-1 codes),
 * with their native display names. Keep in sync with
 * SUPPORTED_VOICE_LANGUAGES in services/backend/backend/routes/voices.py.
 */
export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
] as const;

export type VoiceLanguageCode = (typeof VOICE_LANGUAGES)[number]['code'];

export const DEFAULT_VOICE_LANGUAGE: VoiceLanguageCode = 'en';

export function isVoiceLanguageCode(
  value: string | null | undefined,
): value is VoiceLanguageCode {
  return VOICE_LANGUAGES.some((language) => language.code === value);
}

/**
 * Initial value for the voice language dropdown: the user's expected
 * transcription language when set, otherwise the UI locale.
 */
export function getDefaultVoiceLanguage(
  transcriptionLanguage: string | null | undefined,
  locale: Locale,
): VoiceLanguageCode {
  if (isVoiceLanguageCode(transcriptionLanguage)) {
    return transcriptionLanguage;
  }
  if (isVoiceLanguageCode(locale)) {
    return locale;
  }
  return DEFAULT_VOICE_LANGUAGE;
}
