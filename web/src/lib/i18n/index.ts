export { en } from "./catalogs/en-us";
export { vi } from "./catalogs/vi-vn";
export { zhCN } from "./catalogs/zh-cn";
export { type Dictionary, findMissingKeys, findStaleKeys, type TranslateValues, translate } from "./dictionary";
export {
  applyLocale,
  getLocale,
  type I18nContextValue,
  I18nProvider,
  setLocale,
  type TranslateFn,
  t,
  useI18n,
} from "./i18n-provider";
export {
  DEFAULT_LOCALE,
  getLocaleOption,
  isLocale,
  LOCALE_OPTIONS,
  LOCALE_VALUES,
  type Locale,
  resolveLocale,
  SOURCE_LOCALE,
  toBcp47,
} from "./locale";
