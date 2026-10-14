"use client";

import * as React from "react";

import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ── DSL autocomplete ──────────────────────────────────────────────────────────
// Shared by the global asset view (/function/assets) and the per-task 测试资产
// search, so both search boxes behave and look identical.

function getDslFields(t: (k: string) => string): { name: string; desc: string; ops: { op: string; desc: string }[] }[] {
  const fuzzy = t("assetDsl.op.fuzzyMatch");
  const exact = t("assetDsl.op.exactMatch");
  const exclude = t("assetDsl.op.exclude");
  const textOps = [
    { op: "=", desc: fuzzy },
    { op: "==", desc: exact },
    { op: "!=", desc: exclude },
  ];
  const numOps = [
    { op: "==", desc: t("assetDsl.op.equal") },
    { op: "!=", desc: t("assetDsl.op.notEqual") },
    { op: ">", desc: t("assetDsl.op.greaterThan") },
    { op: ">=", desc: t("assetDsl.op.greaterThanOrEqual") },
    { op: "<", desc: t("assetDsl.op.lessThan") },
    { op: "<=", desc: t("assetDsl.op.lessThanOrEqual") },
  ];
  const exactOnlyOps = [
    { op: "==", desc: exact },
    { op: "!=", desc: exclude },
  ];

  return [
    { name: "domain", desc: t("assetDsl.field.domain"), ops: textOps },
    { name: "ip", desc: t("assetDsl.field.ip"), ops: textOps },
    { name: "url", desc: t("assetDsl.field.url"), ops: textOps },
    { name: "root_domain", desc: t("assetDsl.field.rootDomain"), ops: textOps },
    { name: "page_title", desc: t("assetDsl.field.pageTitle"), ops: textOps },
    { name: "icp", desc: t("assetDsl.field.icp"), ops: textOps },
    { name: "service_name", desc: t("assetDsl.field.serviceName"), ops: textOps },
    { name: "app_name", desc: t("assetDsl.field.appName"), ops: textOps },
    { name: "bundle_id", desc: t("assetDsl.field.bundleId"), ops: textOps },
    { name: "category", desc: t("assetDsl.field.category"), ops: textOps },
    { name: "app_icp", desc: t("assetDsl.field.appIcp"), ops: textOps },
    { name: "method", desc: t("assetDsl.field.method"), ops: exactOnlyOps },
    { name: "service_type", desc: t("assetDsl.field.serviceType"), ops: exactOnlyOps },
    { name: "record_type", desc: t("assetDsl.field.recordType"), ops: exactOnlyOps },
    { name: "technology", desc: t("assetDsl.field.technology"), ops: textOps },
    { name: "port", desc: t("assetDsl.field.port"), ops: numOps },
    { name: "status_code", desc: t("assetDsl.field.statusCode"), ops: numOps },
    { name: "company_id", desc: t("assetDsl.field.companyId"), ops: [{ op: "==", desc: t("assetDsl.op.equal") }] },
    { name: "task_id", desc: t("assetDsl.field.taskId"), ops: [{ op: "==", desc: t("assetDsl.op.equal") }] },
  ];
}

function getLogicOps(t: (k: string) => string): { label: string; desc: string }[] {
  return [
    { label: "AND", desc: t("assetDsl.logic.andDesc") },
    { label: "OR", desc: t("assetDsl.logic.orDesc") },
  ];
}

interface DslSuggestion {
  kind: "field" | "operator" | "logic";
  label: string;
  desc: string;
  replaceStart: number;
  replaceEnd: number;
  insertText: string;
}

function getDslSuggestions(text: string, cursor: number, t: (k: string) => string): DslSuggestion[] {
  const dslFields = getDslFields(t);
  const logicOps = getLogicOps(t);
  const before = text.slice(0, cursor);
  // Current token: non-whitespace, non-paren run ending at cursor
  const tokenMatch = before.match(/([^\s()]*$)/);
  const currentToken = tokenMatch?.[1] ?? "";
  const tokenStart = cursor - currentToken.length;

  // Token already contains field+operator → typing a value, no suggestions
  if (/^[a-z_]+(==|!=|>=|<=|=|>|<)/.test(currentToken)) return [];

  // Complete known field name → suggest operators for that field
  const exactField = dslFields.find((f) => f.name === currentToken.toLowerCase());
  if (exactField) {
    return exactField.ops.map(({ op, desc }) => ({
      kind: "operator",
      label: `${exactField.name}${op}`,
      desc,
      replaceStart: tokenStart,
      replaceEnd: cursor,
      insertText: `${exactField.name}${op}`,
    }));
  }

  // Everything before the current token (trimmed)
  const beforeToken = before.slice(0, tokenStart).trimEnd();
  const afterExpression = beforeToken.length > 0 && !/\b(AND|OR)\s*$/i.test(beforeToken) && !beforeToken.endsWith("(");

  // Current token is a prefix of AND/OR and follows a complete expression
  if (/^(a|an|and|o|or)$/i.test(currentToken) && afterExpression) {
    return logicOps.filter((l) => l.label.startsWith(currentToken.toUpperCase())).map(({ label, desc }) => ({
      kind: "logic",
      label,
      desc,
      replaceStart: tokenStart,
      replaceEnd: cursor,
      insertText: `${label} `,
    }));
  }

  // No current token, after a complete expression → suggest AND/OR
  if (!currentToken && afterExpression) {
    return logicOps.map(({ label, desc }) => ({
      kind: "logic",
      label,
      desc,
      replaceStart: cursor,
      replaceEnd: cursor,
      insertText: `${label} `,
    }));
  }

  // Default: suggest fields filtered by prefix
  const prefix = currentToken.toLowerCase();
  return dslFields.filter((f) => f.name.startsWith(prefix)).map((f) => ({
    kind: "field",
    label: f.name,
    desc: f.desc,
    replaceStart: tokenStart,
    replaceEnd: cursor,
    insertText: f.name,
  }));
}

function applyDslSuggestion(text: string, s: DslSuggestion): { text: string; cursor: number } {
  const newText = text.slice(0, s.replaceStart) + s.insertText + text.slice(s.replaceEnd);
  return { text: newText, cursor: s.replaceStart + s.insertText.length };
}

const KIND_STYLE: Record<string, string> = {
  field: "text-blue-500 dark:text-blue-400",
  operator: "text-amber-500 dark:text-amber-400",
  logic: "text-emerald-500 dark:text-emerald-400",
};

// AssetDslSearch is the shared DSL search box: a monospace input with a
// field/operator/logic autocomplete popover and a status line ("找到 N 条" /
// error / loading). Used by both the global asset view and the per-task view.
export function AssetDslSearch({
  query,
  onChange,
  loading,
  error,
  count,
}: {
  query: string;
  onChange: (v: string) => void;
  loading: boolean;
  error: string;
  count?: number;
}) {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = React.useState<DslSuggestion[]>([]);
  const [selIdx, setSelIdx] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  const refresh = React.useCallback(
    (val: string, pos: number) => {
      const suggs = getDslSuggestions(val, pos, t);
      setSuggestions(suggs);
      setSelIdx(0);
      setOpen(suggs.length > 0);
    },
    [t],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    refresh(val, e.target.selectionStart ?? val.length);
  };

  const apply = React.useCallback(
    (s: DslSuggestion) => {
      const cursor = inputRef.current?.selectionStart ?? query.length;
      // use cursor for logic-kind (insert at cursor), replaceStart/End for others
      const adjusted: DslSuggestion =
        s.kind === "logic" && !query.slice(s.replaceStart, s.replaceEnd)
          ? { ...s, replaceStart: cursor, replaceEnd: cursor }
          : s;
      const { text: newText, cursor: newCursor } = applyDslSuggestion(query, adjusted);
      onChange(newText);
      requestAnimationFrame(() => {
        if (!inputRef.current) return;
        inputRef.current.setSelectionRange(newCursor, newCursor);
        inputRef.current.focus();
        refresh(newText, newCursor);
      });
    },
    [query, onChange, refresh],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Tab" || e.key === "Enter") {
      const s = suggestions[selIdx];
      if (s) {
        e.preventDefault();
        apply(s);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const cursorPos = () => inputRef.current?.selectionStart ?? query.length;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative max-w-lg">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={t("assetDsl.search.placeholder")}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => refresh(query, cursorPos())}
          onClick={() => refresh(query, cursorPos())}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          className="h-8 pl-8 font-mono text-xs"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1 w-max min-w-full max-w-sm rounded-md border bg-popover py-1 shadow-md">
            {suggestions.map((s, i) => (
              <button
                type="button"
                key={i}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left",
                  i === selIdx ? "bg-accent" : "hover:bg-accent/50",
                )}
                onMouseEnter={() => setSelIdx(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  apply(s);
                }}
              >
                <span className={cn("shrink-0 font-mono text-xs font-semibold", KIND_STYLE[s.kind])}>{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {query.trim() && !open && (
        <p className="pl-1 text-[11px] text-muted-foreground">
          {loading ? t("assetDsl.status.searching") : error ? <span className="text-destructive">{error}</span> : t("assetDsl.status.foundCount", { count: count ?? 0 })}
        </p>
      )}
    </div>
  );
}
