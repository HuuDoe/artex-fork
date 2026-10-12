"use client";

import * as React from "react";

import { LanguagesIcon } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { LOCALE_OPTIONS, type Locale } from "@/lib/i18n/locale";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

/**
 * Interface language picker.
 *
 * Persisted as a browser cookie (see `PREFERENCE_PERSISTENCE.locale`) so it is
 * readable by the pre-hydration boot script and applied without a flash.
 * Changing it also updates the preferences store, which drives `<html lang>`.
 */
export function LanguageCard() {
  const { t, setLocale: applyLocaleChoice } = useI18n();
  const locale = usePreferencesStore((s) => s.locale);
  const setStoredLocale = usePreferencesStore((s) => s.setLocale);

  const onChange = React.useCallback(
    (next: string) => {
      const value = next as Locale;
      setStoredLocale(value);
      applyLocaleChoice(value);
      void persistPreference("locale", value);
      toast.success(t("settings.language.changed"));
    },
    [applyLocaleChoice, setStoredLocale, t],
  );

  return (
    <Card className="mb-4 break-inside-avoid md:mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LanguagesIcon className="size-4" />
          {t("settings.language.title")}
        </CardTitle>
        <CardDescription>{t("settings.language.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Label htmlFor="ui-language" className="text-sm font-normal text-muted-foreground">
          {t("settings.language.title")}
        </Label>
        <Select value={locale} onValueChange={onChange}>
          <SelectTrigger id="ui-language" className="mt-2 w-full" aria-label={t("settings.language.title")}>
            <SelectValue placeholder={t("settings.language.title")} />
          </SelectTrigger>
          <SelectContent>
            {LOCALE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.nativeLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
