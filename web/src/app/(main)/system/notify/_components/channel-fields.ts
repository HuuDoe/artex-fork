// 渠道字段表与配置值的解析工具。
//
// 与页面拆开是因为这一份是**数据**而不是视图：它描述每种渠道有哪些字段、
// 各自该用什么控件，以及表单文本到配置值（JSON）的双向转换。
// 单独放一个文件后，新增渠道只需要动这里，页面本身不必改。
// 渠道类型的展示名与简介。放在前端是因为它只影响文案，后端不需要知道。
export const KIND_LABEL: Record<string, string> = {
  dingtalk: "DingTalk",
  feishu: "Feishu",
  wecom: "WeCom",
  webhook: "Custom Webhook",
  telegram: "Telegram",
  email: "Email",
};

export function getKindLabel(kind: string, t?: (k: string) => string): string {
  if (t) {
    const k = `notify.kind.${kind}`;
    const val = t(k);
    if (val && val !== k) return val;
  }
  return KIND_LABEL[kind] ?? kind;
}

// 各渠道的配置字段定义。
export type FieldKind = "text" | "password" | "number" | "select" | "textarea" | "switch" | "kv" | "list";
export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
}
export const CHANNEL_FIELDS: Record<string, FieldDef[]> = {
  dingtalk: [
    {
      key: "webhook",
      label: "Webhook URL",
      kind: "text",
      placeholder: "https://oapi.dingtalk.com/robot/send?access_token=...",
    },
    {
      key: "secret",
      label: "Sign Secret",
      kind: "password",
      help: "Fill in when bot security is set to 'Sign'; leave empty if using keywords or no security",
    },
  ],
  feishu: [
    {
      key: "webhook",
      label: "Webhook URL",
      kind: "text",
      placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/...",
    },
    { key: "secret", label: "Sign Secret", kind: "password", help: "Fill in when bot has sign verification enabled, otherwise leave empty" },
  ],
  wecom: [
    {
      key: "webhook",
      label: "Webhook URL",
      kind: "text",
      placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...",
    },
  ],
  webhook: [
    { key: "url", label: "Target URL", kind: "text", placeholder: "https://your-endpoint.example.com/hook" },
    {
      key: "method",
      label: "HTTP Method",
      kind: "select",
      options: [
        { value: "POST", label: "POST (with body)" },
        { value: "PUT", label: "PUT (with body)" },
        { value: "PATCH", label: "PATCH (with body)" },
        { value: "GET", label: "GET (no body)" },
      ],
    },
    { key: "headers", label: "Custom Headers", kind: "kv", help: "KEY=VALUE per line, e.g. Authorization=Bearer xxx" },
    {
      key: "body_template",
      label: "Body Template",
      kind: "textarea",
      help:
        "Leave empty for default template. Variables: {{.Title}} {{.Batch}} {{.Count}} {{.HomeURL}} {{.SentAt}}, " +
        "range .Items: .Name/.VulnClass/.Severity/.Summary/.Assets/.DetailURL/.StatusLabel. Use {{json .Xxx}} for strings.",
    },
  ],
  telegram: [
    { key: "bot_token", label: "Bot Token", kind: "password", placeholder: "123456:ABC-DEF..." },
    { key: "chat_id", label: "Chat ID", kind: "text", placeholder: "-1001234567890" },
    {
      key: "base_url",
      label: "API URL",
      kind: "text",
      placeholder: "https://api.telegram.org",
      help: "Leave empty for official API; fill when using custom reverse proxy",
    },
  ],
  email: [
    { key: "host", label: "SMTP Host", kind: "text", placeholder: "smtp.example.com" },
    {
      key: "port",
      label: "Port",
      kind: "number",
      placeholder: "587",
      help: "587 for STARTTLS; turn on Implicit TLS for 465",
    },
    { key: "username", label: "Username", kind: "text" },
    { key: "password", label: "Password / Auth Code", kind: "password" },
    { key: "from", label: "Sender", kind: "text", placeholder: "artex@example.com" },
    { key: "to", label: "Recipients", kind: "list", help: "Comma-separated email addresses" },
    { key: "tls", label: "Implicit TLS", kind: "switch", help: "Enable for port 465; keep disabled for 587 (uses STARTTLS)" },
  ],
};

export const SEVERITY_OPTIONS = [
  { value: "", label: "All" },
  { value: "low", label: "Low and above" },
  { value: "medium", label: "Medium and above" },
  { value: "high", label: "High and above" },
  { value: "critical", label: "Critical only" },
];

export function getSeverityOptions(t?: (k: string) => string) {
  if (!t) return SEVERITY_OPTIONS;
  return [
    { value: "", label: t("notify.severity.all") },
    { value: "low", label: t("notify.severity.low") },
    { value: "medium", label: t("notify.severity.medium") },
    { value: "high", label: t("notify.severity.high") },
    { value: "critical", label: t("notify.severity.critical") },
  ];
}

export type ChannelForm = {
  name: string;
  kind: string;
  mode: "realtime" | "digest";
  enabled: boolean;
  ratePerMin: string;
  config: Record<string, unknown>;
  minSeverity: string;
  includeText: string;
  excludeText: string;
  taskIDsText: string;
  assetIDsText: string;
  onStatusChange: boolean;
};

export const emptyForm = (kind: string): ChannelForm => ({
  name: "",
  kind,
  mode: "realtime",
  enabled: true,
  ratePerMin: "",
  config: {},
  minSeverity: "",
  includeText: "",
  excludeText: "",
  taskIDsText: "",
  assetIDsText: "",
  onStatusChange: false,
});

// parseKV 解析「每行 KEY=VALUE」的文本域。
export function parseKV(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const i = t.indexOf("=");
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}
// parseIDs 解析逗号/空白分隔的 id 列表。
export function parseIDs(text: string): number[] {
  return text
    .split(/[\s,，]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}
// parseKeywords 解析行/逗号分隔的关键词列表（漏洞类型名可能含空格，所以按行或逗号切）。
export function parseKeywords(text: string): string[] {
  return text
    .split(/[\n,，]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
