"use client";

import * as React from "react";

import Link from "next/link";

import { RotateCcwIcon } from "lucide-react";

import { FindingRetestDialog } from "@/components/finding-retest-dialog";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toBcp47, useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { FindingRetest } from "@/lib/types";

const statusKeys: Record<string, string> = {
  pending: "findings.retest.status.pending",
  running: "findings.retest.status.running",
  completed: "findings.retest.status.completed",
  failed: "findings.retest.status.failed",
  stopped: "findings.retest.status.stopped",
};
const verdictKeys: Record<string, string> = {
  reproduced: "findings.retest.verdict.reproduced",
  fixed: "findings.retest.verdict.fixed",
  inconclusive: "findings.retest.verdict.inconclusive",
};

function active(r: FindingRetest) {
  return r.status === "pending" || r.status === "running";
}

export function FindingRetestPanel({
  findingId,
  findingName,
  readOnly = false,
  onCompleted,
}: {
  findingId: string;
  findingName?: string;
  readOnly?: boolean;
  onCompleted?: () => void;
}) {
  const { t, locale } = useI18n();
  const [items, setItems] = React.useState<FindingRetest[] | null>(null);
  const [error, setError] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const requestSeq = React.useRef(0);
  const previousItems = React.useRef<FindingRetest[]>([]);

  const load = React.useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const rows = await api.findingRetests(findingId);
      if (seq !== requestSeq.current) return;
      const completed = previousItems.current.some(
        (item) => active(item) && rows.some((row) => row.id === item.id && !active(row)),
      );
      previousItems.current = rows;
      setItems(rows);
      setError("");
      if (completed) onCompleted?.();
    } catch (e) {
      if (seq === requestSeq.current) setError((e as Error).message);
    }
  }, [findingId, onCompleted]);

  React.useEffect(() => {
    void load();
    return () => {
      requestSeq.current++;
    };
  }, [load]);

  React.useEffect(() => {
    if (error || !items?.some(active)) return;
    const timer = setTimeout(() => void load(), 3000);
    return () => clearTimeout(timer);
  }, [error, items, load]);

  const running = items?.find(active);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{t("findings.retest.cardTitle")}</CardTitle>
          <CardDescription>{t("findings.retest.cardDescription")}</CardDescription>
        </div>
        {running?.conversation_id != null ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/chat?c=${running.conversation_id}`} title={t("findings.retest.viewActiveSession")}>
              <Spinner data-icon="inline-start" aria-hidden="true" />
              {t("findings.table.retesting")}
            </Link>
          </Button>
        ) : null}
        {!running && !readOnly ? (
          <Button size="sm" onClick={() => setOpen(true)} disabled={items === null || !!error}>
            <RotateCcwIcon data-icon="inline-start" />
            {t("findings.table.retest")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t("findings.retest.loadFailed", { error })}
              <Button variant="outline" size="sm" onClick={() => void load()}>
                {t("action.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {!error && items === null ? <Skeleton className="h-16 w-full" /> : null}
        {!error && items?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("findings.retest.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("findings.retest.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {!error && items
          ? items.map((item) => (
              <div key={item.id} className="flex min-w-0 flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={item.status === "completed" && item.verdict === "reproduced" ? "destructive" : "secondary"}
                  >
                    {item.status === "completed" && item.verdict
                      ? (verdictKeys[item.verdict] ? t(verdictKeys[item.verdict]) : item.verdict)
                      : (statusKeys[item.status] ? t(statusKeys[item.status]) : item.status)}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    #{item.id} · {new Date(item.created_at).toLocaleString(toBcp47(locale))}
                  </span>
                  {item.conversation_id != null ? (
                    <Button asChild variant="ghost" size="sm" className="ml-auto">
                      <Link href={`/chat?c=${item.conversation_id}`}>{t("findings.retest.viewSession")}</Link>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">{t("findings.retest.sessionDeleted")}</span>
                  )}
                </div>
                {item.status === "completed" && item.summary ? (
                  <p className="whitespace-pre-wrap break-words text-sm">{item.summary}</p>
                ) : null}
                {item.error ? (
                  <p className="whitespace-pre-wrap break-words text-destructive text-sm">{item.error}</p>
                ) : null}
                {item.notes ? (
                  <p className="whitespace-pre-wrap break-words text-muted-foreground text-xs">
                    {t("findings.retest.notesPrefix", { notes: item.notes })}
                  </p>
                ) : null}
                {item.status === "completed" && item.evidence ? (
                  <details className="min-w-0">
                    <summary className="cursor-pointer text-sm">{t("findings.retest.evidence")}</summary>
                    <div className="mt-3 overflow-x-auto">
                      <Markdown text={item.evidence} />
                    </div>
                  </details>
                ) : null}
              </div>
            ))
          : null}
      </CardContent>
      {open ? (
        <FindingRetestDialog
          findingId={findingId}
          findingName={findingName}
          onClose={() => setOpen(false)}
          onStarted={(retest) => {
            requestSeq.current++;
            const rows = [retest, ...previousItems.current.filter((item) => item.id !== retest.id)];
            previousItems.current = rows;
            setItems(rows);
            setError("");
            void load();
          }}
        />
      ) : null}
    </Card>
  );
}
