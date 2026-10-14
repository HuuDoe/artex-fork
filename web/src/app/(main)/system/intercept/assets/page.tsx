"use client";

import * as React from "react";

import { BanIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getAssetRuleDisplayName } from "@/lib/i18n/builtin-labels";
import type { AssetInterceptKind, AssetInterceptRule } from "@/lib/types";

// ---- kind 元信息 ----

const KIND_KEY_MAP: Record<AssetInterceptKind, string> = {
  exact_domain: "assetIntercept.kind.exactDomain",
  exact_ip: "assetIntercept.kind.exactIp",
  exact_url: "assetIntercept.kind.exactUrl",
  fuzzy_domain: "assetIntercept.kind.fuzzyDomain",
  fuzzy_ip: "assetIntercept.kind.fuzzyIp",
  fuzzy_url: "assetIntercept.kind.fuzzyUrl",
  cidr: "assetIntercept.kind.cidr",
};

const KIND_PLACEHOLDER: Record<AssetInterceptKind, string> = {
  exact_domain: "example.gov.cn",
  exact_ip: "203.0.113.10",
  exact_url: "https://example.gov.cn/login",
  fuzzy_domain: ".gov.cn",
  fuzzy_ip: "203.0.113.",
  fuzzy_url: "/admin",
  cidr: "192.168.0.0/16",
};

function KindBadge({ kind }: { kind: AssetInterceptKind }) {
  const { t } = useI18n();
  const fuzzy = kind.startsWith("fuzzy_");
  const cidr = kind === "cidr";
  return (
    <Badge
      variant="outline"
      className={
        cidr
          ? "border-sky-400 text-sky-600"
          : fuzzy
            ? "border-amber-400 text-amber-600"
            : "border-emerald-400 text-emerald-600"
      }
    >
      {t(KIND_KEY_MAP[kind])}
    </Badge>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---- form state ----

type RuleForm = {
  enabled: boolean;
  kind: AssetInterceptKind;
  pattern: string;
  note: string;
};

const defaultForm = (): RuleForm => ({ enabled: true, kind: "fuzzy_domain", pattern: "", note: "" });

// 前端轻校验（与后端一致：仅 exact_ip / cidr 做格式校验，其余交后端）。
function frontValidate(form: RuleForm, t: (k: string) => string): string | null {
  const p = form.pattern.trim();
  if (!p) return t("assetIntercept.validation.required");
  if (form.kind === "cidr" && !/^[0-9a-fA-F:.]+\/\d{1,3}$/.test(p)) {
    return t("assetIntercept.validation.invalidCidr");
  }
  return null;
}

// ---- page ----

export default function AssetInterceptPage() {
  const { t } = useI18n();
  const [rules, setRules] = React.useState<AssetInterceptRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AssetInterceptRule | null>(null);
  const [form, setForm] = React.useState<RuleForm>(defaultForm());
  const [saving, setSaving] = React.useState(false);

  const kindGroups = React.useMemo(() => [
    {
      group: t("assetIntercept.group.exact"),
      options: [
        { value: "exact_domain" as const, label: t("assetIntercept.kind.exactDomain") },
        { value: "exact_ip" as const, label: t("assetIntercept.kind.exactIp") },
        { value: "exact_url" as const, label: t("assetIntercept.kind.exactUrl") },
      ],
    },
    {
      group: t("assetIntercept.group.fuzzy"),
      options: [
        { value: "fuzzy_domain" as const, label: t("assetIntercept.kind.fuzzyDomain") },
        { value: "fuzzy_ip" as const, label: t("assetIntercept.kind.fuzzyIp") },
        { value: "fuzzy_url" as const, label: t("assetIntercept.kind.fuzzyUrl") },
      ],
    },
    {
      group: t("assetIntercept.group.cidr"),
      options: [
        { value: "cidr" as const, label: t("assetIntercept.kind.cidr") },
      ],
    },
  ], [t]);

  const load = React.useCallback(async () => {
    try {
      setRules(await api.assetInterceptRules());
    } catch {
      toast.error(t("assetIntercept.toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  function set(patch: Partial<RuleForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function openNew() {
    setEditing(null);
    setForm(defaultForm());
    setOpen(true);
  }

  function openEdit(rule: AssetInterceptRule) {
    setEditing(rule);
    setForm({ enabled: rule.enabled, kind: rule.kind, pattern: rule.pattern, note: rule.note });
    setOpen(true);
  }

  async function handleSave() {
    const err = frontValidate(form, t);
    if (err) {
      toast.error(err);
      return;
    }
    const payload = { ...form, pattern: form.pattern.trim() };
    setSaving(true);
    try {
      if (editing) {
        await api.updateAssetInterceptRule(editing.id, payload);
        toast.success(t("assetIntercept.toast.updated"));
      } else {
        await api.createAssetInterceptRule(payload);
        toast.success(t("assetIntercept.toast.created"));
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: AssetInterceptRule) {
    if (!window.confirm(t("assetIntercept.confirmDelete", { pattern: rule.pattern }))) return;
    try {
      await api.deleteAssetInterceptRule(rule.id);
      toast.success(t("assetIntercept.toast.deleted"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleToggle(rule: AssetInterceptRule) {
    try {
      await api.toggleAssetInterceptRule(rule.id, !rule.enabled);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const placeholder = KIND_PLACEHOLDER[form.kind] ?? "";

  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      {/* header */}
      <div className="flex items-center gap-2.5">
        <BanIcon className="h-5 w-5 shrink-0" />
        <div>
          <h1 className="text-lg font-semibold leading-tight">{t("assetIntercept.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("assetIntercept.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("assetIntercept.description")}
        </p>
        <Button onClick={openNew} size="sm" className="shrink-0">
          <PlusIcon className="h-4 w-4" />
          {t("assetIntercept.newRule")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">{t("assetIntercept.loading")}</p>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <BanIcon className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("assetIntercept.noRules")}</p>
              <Button size="sm" variant="outline" onClick={openNew}>
                <PlusIcon className="h-4 w-4" />
                {t("assetIntercept.newFirstRule")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[130px]">{t("assetIntercept.th.type")}</TableHead>
                  <TableHead>{t("assetIntercept.th.pattern")}</TableHead>
                  <TableHead>{t("assetIntercept.th.remark")}</TableHead>
                  <TableHead className="w-[64px] text-center">{t("assetIntercept.th.enabled")}</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className={!rule.enabled ? "opacity-40" : ""}>
                    <TableCell>
                      <KindBadge kind={rule.kind} />
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <code className="block truncate rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {rule.pattern}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        {rule.builtin && (
                          <Badge variant="secondary" className="shrink-0 px-1 py-0 text-[10px]">
                            {t("common.builtin")}
                          </Badge>
                        )}
                        <span className="truncate">{getAssetRuleDisplayName(rule.note, rule.note, t)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={rule.enabled} onCheckedChange={() => handleToggle(rule)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(rule)}>
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(rule)}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* editor sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{editing ? t("assetIntercept.sheet.editTitle") : t("assetIntercept.sheet.newTitle")}</SheetTitle>
            <SheetDescription className="text-xs">{t("assetIntercept.sheet.description")}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            <Field label={t("assetIntercept.sheet.typeLabel")}>
              <Select value={form.kind} onValueChange={(v) => set({ kind: v as AssetInterceptKind })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kindGroups.map((g) => (
                    <React.Fragment key={g.group}>
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {g.group}
                      </div>
                      {g.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t("assetIntercept.sheet.patternLabel")}
              hint={
                form.kind === "cidr"
                  ? t("assetIntercept.hint.cidr")
                  : form.kind.startsWith("fuzzy_")
                    ? t("assetIntercept.hint.fuzzy")
                    : t("assetIntercept.hint.exact")
              }
            >
              <Input
                placeholder={placeholder}
                value={form.pattern}
                onChange={(e) => set({ pattern: e.target.value })}
              />
            </Field>

            <Field label={t("assetIntercept.sheet.remarkLabel")}>
              <Textarea
                placeholder={t("assetIntercept.sheet.remarkPlaceholder")}
                value={form.note}
                onChange={(e) => set({ note: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </Field>

            <Separator />

            <div className="flex items-center gap-3">
              <Switch id="asset-rule-enabled" checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} />
              <Label htmlFor="asset-rule-enabled" className="cursor-pointer">
                {t("assetIntercept.sheet.enableRule")}
              </Label>
            </div>
          </div>

          <SheetFooter className="border-t px-6 py-4 flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("action.saving") : t("action.save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
