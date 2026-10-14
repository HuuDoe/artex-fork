"use client";

/**
 * Locale persistence + React binding for the i18n layer.
 *
 * The active locale lives in the existing preferences store and is persisted
 * through the same cookie mechanism as theme/font, so it survives reloads and
 * is readable by the pre-hydration boot script (which sets `<html lang>`).
 */

import * as React from "react";
import { createContext, useContext } from "react";

import { setClientCookie } from "@/lib/cookie.client";

import { en } from "./catalogs/en-us";
import { vi } from "./catalogs/vi-vn";
import { zhCN } from "./catalogs/zh-cn";
import { type Dictionary, translate } from "./dictionary";
import { DEFAULT_LOCALE, type Locale, resolveLocale, toBcp47 } from "./locale";

const COOKIE_KEY = "locale";
const COOKIE_DAYS = 365;

const CATALOGS: Record<Locale, Dictionary> = {
  "zh-CN": zhCN,
  "en-US": en,
  "vi-VN": vi,
};

/**
 * Locale captured on the server / during SSR, before the cookie is read.
 *
 * On the client the boot script has already written `data-locale` to <html>,
 * so seed from the DOM to avoid a flash of the default language before the
 * preferences store hydrates.
 */
function detectInitialLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return resolveLocale(document.documentElement.getAttribute("data-locale"));
}

let activeLocale: Locale = detectInitialLocale();

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLocale(): Locale {
  return activeLocale;
}

const DOCUMENT_TITLES: Record<Locale, string> = {
  "en-US": "ARTEX — Autonomous Penetration Testing Console",
  "vi-VN": "ARTEX — Bảng điều khiển kiểm thử thâm nhập tự động",
  "zh-CN": "ARTEX — 自主渗透测试控制台",
};

/**
 * Apply a locale to the document. Called on boot (from the preferences store
 * hydration) and whenever the user picks a different language.
 */
export function applyLocale(locale: Locale) {
  activeLocale = locale;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", toBcp47(locale));
    document.documentElement.setAttribute("data-locale", locale);
    if (DOCUMENT_TITLES[locale]) {
      document.title = DOCUMENT_TITLES[locale];
    }
  }
  emit();
}

export function setLocale(locale: Locale) {
  setClientCookie(COOKIE_KEY, locale, COOKIE_DAYS);
  applyLocale(locale);
}

function useLocaleSnapshot(): Locale {
  return React.useSyncExternalStore(
    subscribe,
    () => activeLocale,
    () => DEFAULT_LOCALE,
  );
}

export type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

export type I18nContextValue = {
  locale: Locale;
  t: TranslateFn;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * The provider deliberately holds no locale of its own: the single source of
 * truth is `activeLocale`, which the preferences store keeps in sync through
 * `applyLocale`. Pinning a value here (e.g. from a server prop) would freeze
 * `t()` on the default language and make the language picker look broken.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocaleSnapshot();

  const value = React.useMemo<I18nContextValue>(() => {
    const dictionary = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
    return {
      locale,
      t: (key, values) => translate(dictionary, zhCN, key, values),
      setLocale,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  const current = useLocaleSnapshot();

  // Hooks must run unconditionally, so the no-provider fallback is built with
  // useMemo instead of being returned before the hook calls below.
  const fallback = React.useMemo<I18nContextValue>(
    () => ({
      locale: current,
      t: (key, values) => translate(CATALOGS[current] ?? CATALOGS[DEFAULT_LOCALE], zhCN, key, values),
      setLocale,
    }),
    [current],
  );

  // Outside a provider (e.g. isolated component tests) fall back to the
  // module-level active locale so `t()` still resolves.
  return ctx ?? fallback;
}

/** Translate outside React (event handlers, `toast()` calls in callbacks). */
export function t(key: string, values?: Record<string, string | number>): string {
  return translate(CATALOGS[activeLocale] ?? CATALOGS[DEFAULT_LOCALE], zhCN, key, values);
}
