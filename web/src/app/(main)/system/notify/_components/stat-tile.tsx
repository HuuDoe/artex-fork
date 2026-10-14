import { Card, CardContent } from "@/components/ui/card";

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card size="sm" className="gap-1">
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-lg font-semibold ${tone === "red" ? "text-rose-600" : ""}`}>{value}</p>
        {hint && <p className={`text-xs ${tone === "red" ? "text-rose-600" : "text-muted-foreground"}`}>{hint}</p>}
      </CardContent>
    </Card>
  );
}

// formatBacklog 把积压毫秒数渲染成人看得懂的量级。
export function formatBacklog(ms: number, t?: (k: string, p?: Record<string, string | number>) => string): string {
  if (!ms) return "—";
  if (ms < 60_000) {
    const s = Math.round(ms / 1000);
    return t ? t("notify.backlog.seconds", { count: s }) : `${s} 秒`;
  }
  if (ms < 3_600_000) {
    const m = Math.round(ms / 60_000);
    return t ? t("notify.backlog.minutes", { count: m }) : `${m} 分钟`;
  }
  const h = (ms / 3_600_000).toFixed(1);
  return t ? t("notify.backlog.hours", { count: h }) : `${h} 小时`;
}
