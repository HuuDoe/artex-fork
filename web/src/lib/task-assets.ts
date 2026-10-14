import type { NewAssetType } from "@/lib/types";

const ASSET_TYPE_LABELS: Record<NewAssetType, string> = {
  app: "应用",
  endpoint: "接口",
  ip: "IP",
  root_domain: "根域名",
  service: "服务",
  subdomain: "子域名",
};

const TASK_ASSET_SOURCE_LABELS: Record<string, string> = {
  agent: "Agent 发现",
  anchor: "黑板锚点",
  api: "资产 API",
  company: "企业关联",
  legacy: "历史关联",
  manual: "人工加入",
  system: "系统关联",
  task: "任务初始化",
};

export function taskAssetTypeLabel(type: NewAssetType, t?: (k: string) => string): string {
  if (t) {
    const key = `assets.type.${type}`;
    const val = t(key);
    if (val && val !== key) return val;
  }
  return ASSET_TYPE_LABELS[type] ?? type;
}

export function taskAssetSourceLabel(source: string, t?: (k: string) => string): string {
  if (t) {
    const key = `tasks.assetSource.${source}`;
    const val = t(key);
    if (val && val !== key) return val;
  }
  return TASK_ASSET_SOURCE_LABELS[source] ?? source;
}
