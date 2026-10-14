"use client";

// LLM 重试配置的共用件：五层重试各自的「次数 + 间隔」。
//
// 五层从内到外：建连(SDK) → 空响应(SDK) → 同 provider 安全窗口 → 轮询熔断 → 意图重跑。
// 前三层跟着端点走，所以每个模型配置都能覆盖全局默认；后两层是进程级的，只有全局一份。
//
// 所有输入都遵循同一套「留空 = 不配置」语义，与后端 db.RetryRule 一致：
//   次数   空/0 = 用内置默认 | -1 = 关闭这层重试 | >0 = 用这个次数
//   间隔   空/0 = 用这层原本的指数退避 | >0 = 改用这个固定毫秒间隔

import * as React from "react";

import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { LLMRetryOverride, LLMRetryPolicy, LLMRetryRule } from "@/lib/types";

export const ZERO_RULE: LLMRetryRule = { attempts: 0, interval_ms: 0 };
export const ZERO_OVERRIDE: LLMRetryOverride = {
  connect: ZERO_RULE,
  empty: ZERO_RULE,
  stream: ZERO_RULE,
};
const ZERO_POLICY: LLMRetryPolicy = {
  ...ZERO_OVERRIDE,
  breaker: ZERO_RULE,
  intent: ZERO_RULE,
};

type LayerMeta = {
  titleKey: string;
  /** 这层重试发生在哪、由谁执行 */
  whereKey: string;
  /** 什么样的错误会走到这层——具体到状态码，别让人猜 */
  triggerKey: string;
  /** 长得像但【不】走这层的错误，省得填了没反应还以为是 bug */
  skipsKey?: string;
  descKey: string;
  attemptsLabelKey: string;
  /** 次数留空时的默认值，用于占位符 */
  defAttempts: number;
  /** 间隔留空时的默认策略，用于占位符 */
  defIntervalKey: string;
  /** 次数填 -1 的含义 */
  offHintKey: string;
};

export const RETRY_LAYERS = {
  connect: {
    titleKey: "llm.retry.layer.connect.title",
    whereKey: "llm.retry.layer.connect.where",
    triggerKey: "llm.retry.layer.connect.trigger",
    skipsKey: "llm.retry.layer.connect.skips",
    descKey: "llm.retry.layer.connect.desc",
    attemptsLabelKey: "llm.retry.layer.connect.attemptsLabel",
    defAttempts: 3,
    defIntervalKey: "llm.retry.layer.connect.defInterval",
    offHintKey: "llm.retry.layer.connect.offHint",
  },
  empty: {
    titleKey: "llm.retry.layer.empty.title",
    whereKey: "llm.retry.layer.empty.where",
    triggerKey: "llm.retry.layer.empty.trigger",
    skipsKey: "llm.retry.layer.empty.skips",
    descKey: "llm.retry.layer.empty.desc",
    attemptsLabelKey: "llm.retry.layer.empty.attemptsLabel",
    defAttempts: 2,
    defIntervalKey: "llm.retry.layer.empty.defInterval",
    offHintKey: "llm.retry.layer.empty.offHint",
  },
  stream: {
    titleKey: "llm.retry.layer.stream.title",
    whereKey: "llm.retry.layer.stream.where",
    triggerKey: "llm.retry.layer.stream.trigger",
    skipsKey: "llm.retry.layer.stream.skips",
    descKey: "llm.retry.layer.stream.desc",
    attemptsLabelKey: "llm.retry.layer.stream.attemptsLabel",
    defAttempts: 2,
    defIntervalKey: "llm.retry.layer.stream.defInterval",
    offHintKey: "llm.retry.layer.stream.offHint",
  },
  breaker: {
    titleKey: "llm.retry.layer.breaker.title",
    whereKey: "llm.retry.layer.breaker.where",
    triggerKey: "llm.retry.layer.breaker.trigger",
    skipsKey: "llm.retry.layer.breaker.skips",
    descKey: "llm.retry.layer.breaker.desc",
    attemptsLabelKey: "llm.retry.layer.breaker.attemptsLabel",
    defAttempts: 3,
    defIntervalKey: "llm.retry.layer.breaker.defInterval",
    offHintKey: "llm.retry.layer.breaker.offHint",
  },
  intent: {
    titleKey: "llm.retry.layer.intent.title",
    whereKey: "llm.retry.layer.intent.where",
    triggerKey: "llm.retry.layer.intent.trigger",
    skipsKey: "llm.retry.layer.intent.skips",
    descKey: "llm.retry.layer.intent.desc",
    attemptsLabelKey: "llm.retry.layer.intent.attemptsLabel",
    defAttempts: 2,
    defIntervalKey: "llm.retry.layer.intent.defInterval",
    offHintKey: "llm.retry.layer.intent.offHint",
  },
} satisfies Record<string, LayerMeta>;

type LayerKey = keyof typeof RETRY_LAYERS;

/** 毫秒的人话，只用于在输入框旁边回显，免得数零。 */
function humanMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Number((ms / 1000).toFixed(2))}s`;
  return `${Number((ms / 60_000).toFixed(2))}min`;
}

/** 受控数字输入：空串 ↔ 0，中间态（"-"、"1e"）原样留在本地，不打扰父级。 */
function NumField({
  id,
  value,
  onChange,
  placeholder,
  min,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  placeholder: string;
  min: number;
}) {
  const [text, setText] = React.useState(value === 0 ? "" : String(value));
  // 父级换了一整套值（读取到策略、切换配置）时跟上；自己敲字时不会走到这里，
  // 因为那时 value 已经等于本地文本 parse 后的结果。
  React.useEffect(() => {
    const incoming = value === 0 ? "" : String(value);
    setText((cur) => (Number(cur || 0) === value ? cur : incoming));
  }, [value]);
  return (
    <Input
      id={id}
      type="number"
      min={min}
      className="w-28 shrink-0"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        onChange(e.target.value.trim() === "" || !Number.isFinite(n) ? 0 : Math.trunc(n));
      }}
    />
  );
}

/** 一层重试的两个旋钮。idPrefix 用来在同一页出现多次时保住 label 的 htmlFor。 */
export function RetryRuleFields({
  layer,
  idPrefix,
  value,
  onChange,
  compact,
}: {
  layer: LayerKey;
  idPrefix: string;
  value: LLMRetryRule;
  onChange: (r: LLMRetryRule) => void;
  /** true = 配置抽屉里的紧凑版：省掉展开说明，只留「什么错误会走到这层」这一句 */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const meta = RETRY_LAYERS[layer];
  const human = humanMs(value.interval_ms);
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 rounded-lg border p-3"}>
      <div className="grid gap-0.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <Label className="text-sm">{t(meta.titleKey)}</Label>
          <span className="text-muted-foreground text-xs">{t(meta.whereKey)}</span>
        </div>
        {/* 哪些错误会走到这层，具体到状态码——填了旋钮却看不到效果，多半是错误压根不落在这层。 */}
        <p className="text-muted-foreground text-xs">
          <span className="font-medium text-foreground">{t("llm.retry.triggerPrefix")}</span>：{t(meta.triggerKey)}
        </p>
        {!compact && meta.skipsKey && (
          <p className="text-muted-foreground text-xs">
            <span className="font-medium text-foreground">{t("llm.retry.skipsPrefix")}</span>：{t(meta.skipsKey)}
          </p>
        )}
        {!compact && <p className="text-muted-foreground text-xs">{t(meta.descKey)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-${layer}-n`} className="text-muted-foreground text-xs">
            {t(meta.attemptsLabelKey)}
          </Label>
          <NumField
            id={`${idPrefix}-${layer}-n`}
            min={-1}
            value={value.attempts}
            placeholder={t("llm.retry.defaultAttempts", { count: meta.defAttempts })}
            onChange={(n) => onChange({ ...value, attempts: n })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-${layer}-ms`} className="text-muted-foreground text-xs">
            {t("llm.retry.intervalMs")}
          </Label>
          <NumField
            id={`${idPrefix}-${layer}-ms`}
            min={0}
            value={value.interval_ms}
            placeholder={t("llm.retry.defaultBackoff")}
            onChange={(n) => onChange({ ...value, interval_ms: n })}
          />
          <span className="text-muted-foreground text-xs">{human ? t("llm.retry.fixedInterval", { interval: human }) : t(meta.defIntervalKey)}</span>
        </div>
      </div>
      {!compact && <p className="text-muted-foreground text-xs">{t("llm.retry.layerFooter", { offHint: t(meta.offHintKey) })}</p>}
    </div>
  );
}

/** 模型配置抽屉里的三层覆盖（跟着端点走的那三层）。 */
export function ProfileRetryFields({
  value,
  onChange,
}: {
  value: LLMRetryOverride;
  onChange: (o: LLMRetryOverride) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <Label className="text-sm">{t("llm.retry.overrideTitle")}</Label>
        <p className="text-muted-foreground text-xs">
          {t("llm.retry.overrideDesc")}
        </p>
      </div>
      {(["connect", "empty", "stream"] as const).map((k) => (
        <div key={k} className="border-t pt-3 first:border-t-0 first:pt-0">
          <RetryRuleFields
            compact
            layer={k}
            idPrefix="pf"
            value={value[k]}
            onChange={(r) => onChange({ ...value, [k]: r })}
          />
        </div>
      ))}
    </div>
  );
}

/** 「重试与退避」tab：五层的全局默认值。 */
export function RetryPolicyPanel() {
  const { t } = useI18n();
  const [policy, setPolicy] = React.useState<LLMRetryPolicy>(ZERO_POLICY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.llmRetryPolicy();
      setPolicy({ ...ZERO_POLICY, ...p });
    } catch (e) {
      toast.error(t("llm.retry.loadFailed", { message: (e as Error).message }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      // 后端会把越界值夹回区间并回传，直接用回传值刷新，所见即所存。
      const saved = await api.saveLLMRetryPolicy(policy);
      setPolicy({ ...ZERO_POLICY, ...saved });
      toast.success(t("llm.retry.saveSuccess"));
    } catch (e) {
      toast.error(t("common.saveFailed", { message: (e as Error).message }));
    } finally {
      setSaving(false);
    }
  }

  const set = (k: LayerKey) => (r: LLMRetryRule) => setPolicy((p) => ({ ...p, [k]: r }));

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-10 text-muted-foreground text-sm">
        <Loader2Icon className="size-4 animate-spin" /> {t("llm.retry.loading")}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-xs leading-relaxed">
        {t("llm.retry.bannerIntro")}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(RETRY_LAYERS) as LayerKey[]).map((k) => (
          <RetryRuleFields key={k} layer={k} idPrefix="gl" value={policy[k]} onChange={set(k)} />
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {t("action.save")}
        </Button>
        <Button variant="outline" onClick={() => setPolicy(ZERO_POLICY)} disabled={saving}>
          {t("llm.retry.resetDefaults")}
        </Button>
      </div>
    </div>
  );
}
