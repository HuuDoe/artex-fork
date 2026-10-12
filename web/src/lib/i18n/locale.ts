/**
 * Supported UI locales.
 *
 * ARTEX ships three languages. `zh-CN` is the source language: every message
 * catalog is keyed by its original Chinese string, so a missing translation
 * degrades gracefully back to Chinese instead of rendering a raw key.
 */

export const LOCALE_OPTIONS = [
  { value: "zh-CN", nativeLabel: "简体中文", englishLabel: "Simplified Chinese" },
  { value: "en-US", nativeLabel: "English", englishLabel: "English" },
  { value: "vi-VN", nativeLabel: "Tiếng Việt", englishLabel: "Vietnamese" },
] as const;

export const LOCALE_VALUES = LOCALE_OPTIONS.map((o) => o.value);

export type Locale = (typeof LOCALE_VALUES)[number];

export const DEFAULT_LOCALE: Locale = "en-US";

/**
 * The locale every message key is authored in. Keys are semantic, so this only
 * matters as the fallback for keys a catalog has not translated yet.
 */
export const SOURCE_LOCALE: Locale = "zh-CN";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_VALUES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  if (value === "en") return "en-US";
  if (value === "vi") return "vi-VN";
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getLocaleOption(locale: Locale) {
  return LOCALE_OPTIONS.find((o) => o.value === locale) ?? LOCALE_OPTIONS[0];
}

/**
 * BCP-47 tag used for `<html lang>` and for `Intl.*` formatting.
 */
export function toBcp47(locale: Locale): string {
  return locale;
}
