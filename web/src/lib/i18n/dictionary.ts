/**
 * Message dictionary plumbing.
 *
 * A catalog is a flat `key → string` map. Keys are semantic dot-paths
 * (`nav.dashboard`, `settings.title`) rather than source text, so translators
 * work on meaningful keys and keys stay stable when wording changes.
 *
 * `zh-CN` is the source locale and its catalog is the reference: the other
 * catalogs must define every key it defines. Missing entries fall back to the
 * source string, so a partially translated language still renders.
 */

import { DEFAULT_LOCALE, type Locale } from "./locale";

export type Dictionary = Readonly<Record<string, string>>;

/** Values substituted into `{placeholder}` slots. */
export type TranslateValues = Readonly<Record<string, string | number>>;

function interpolate(template: string, values?: TranslateValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Resolve `t("a.b.c")` against a catalog, falling back to the source catalog
 * and finally to the key itself (so a missing string is obvious, not blank).
 */
export function translate(dictionary: Dictionary, source: Dictionary, key: string, values?: TranslateValues): string {
  const primary = dictionary[key];
  if (primary !== undefined) return interpolate(primary, values);

  const fallback = source[key];
  if (fallback !== undefined) return interpolate(fallback, values);

  return interpolate(key, values);
}

/**
 * Runtime check used by tests and by `scripts/check-i18n.ts` to catch keys that
 * exist in the source catalog but were never translated.
 */
export function findMissingKeys(dictionary: Dictionary, source: Dictionary): string[] {
  return Object.keys(source)
    .filter((key) => dictionary[key] === undefined)
    .sort();
}

/** Keys present in a catalog that no longer exist in the source (stale). */
export function findStaleKeys(dictionary: Dictionary, source: Dictionary): string[] {
  return Object.keys(dictionary)
    .filter((key) => source[key] === undefined)
    .sort();
}

export function resolveCatalog(catalogs: Partial<Record<Locale, Dictionary>>): Dictionary {
  return catalogs[DEFAULT_LOCALE] ?? {};
}
