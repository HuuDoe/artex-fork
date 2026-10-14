export function getAgentDisplayName(key: string, fallback: string, t: (k: string) => string): string {
  const k = `agents.builtin.${key}.name`;
  const val = t(k);
  return val && val !== k ? val : fallback;
}

export function getAgentDisplayDesc(key: string, fallback: string | undefined, t: (k: string) => string): string {
  const k = `agents.builtin.${key}.desc`;
  const val = t(k);
  return val && val !== k ? val : fallback ?? "";
}

const BUILTIN_RULES_MAP: Record<string, string> = {
  "[内置] 递归强制删除 rm -rf": "rules.builtin.rm_rf",
  "[内置] 删除系统关键目录": "rules.builtin.sys_dirs",
  "[内置] 磁盘格式化 mkfs": "rules.builtin.mkfs",
  "[内置] 覆写磁盘设备 dd": "rules.builtin.dd",
  "[内置] Fork 炸弹": "rules.builtin.fork_bomb",
  "[内置] 关机 / 重启": "rules.builtin.shutdown",
  "[内置] 杀死全部进程": "rules.builtin.kill_all",
  "[内置] 磁盘擦除 shred / wipe": "rules.builtin.shred",
  "[内置] 清空防火墙规则": "rules.builtin.iptables",
  "[内置] 停止安全审计 auditd": "rules.builtin.auditd",
  "[内置] 禁用 SELinux": "rules.builtin.selinux",
  "[内置] 篡改系统日志": "rules.builtin.syslog",
  "[内置] 清空 bash 历史": "rules.builtin.history",
  "[内置] 篡改 sudoers": "rules.builtin.sudoers",
  "[内置] 篡改 shadow / passwd": "rules.builtin.shadow",
  "[内置] 篡改 authorized_keys": "rules.builtin.auth_keys",
  "[内置] 写入定时任务 crontab": "rules.builtin.crontab",
  "[内置] 写入 init 启动项": "rules.builtin.init",
  "[内置] 写入 systemd 服务": "rules.builtin.systemd",
  "[内置] 写入全局 profile": "rules.builtin.profile",
  "[内置] 破坏性系统命令": "rules.builtin.destructive_sys",
  "[内置] SQL DROP DATABASE / TABLE / SCHEMA": "rules.builtin.sql_drop",
  "[内置] SQL TRUNCATE": "rules.builtin.sql_truncate",
  "[内置] MongoDB drop / dropDatabase": "rules.builtin.mongo_drop",
  "[内置] Redis FLUSHALL / FLUSHDB": "rules.builtin.redis_flush",
  "[内置] curl / wget 发送 DELETE 请求": "rules.builtin.curl_delete",
  "[内置] Python HTTP 客户端 DELETE（requests/httpx/aiohttp）": "rules.builtin.python_delete",
  "[内置] 脚本中声明 HTTP DELETE 方法（JS/通用）": "rules.builtin.script_delete",
  "[内置] 批量清空 / 清除接口路径": "rules.builtin.bulk_clear_endpoint",
  "[内置] 数据外泄管道": "rules.builtin.data_exfil",
  "[内置] 删除类接口路径": "rules.builtin.delete_endpoint",
};


export function getRuleDisplayName(name: string, fallback: string, t: (k: string) => string): string {
  const k = BUILTIN_RULES_MAP[name];
  if (k) {
    const val = t(k);
    if (val && val !== k) return val;
  }
  return fallback;
}

const BUILTIN_ASSET_RULES_MAP: Record<string, string> = {
  "[内置] 教育网站 (.edu.cn)": "assetRules.builtin.edu_cn",
  "[内置] 教育网站 (.edu)": "assetRules.builtin.edu",
  "[内置] 政府网站 (.gov.cn)": "assetRules.builtin.gov_cn",
  "[内置] 政府网站 (.gov)": "assetRules.builtin.gov",
};

export function getAssetRuleDisplayName(name: string, fallback: string, t: (k: string) => string): string {
  const k = BUILTIN_ASSET_RULES_MAP[name];
  if (k) {
    const val = t(k);
    if (val && val !== k) return val;
  }
  return fallback;
}

export function getToolDisplayDesc(key: string, fallback: string, t: (k: string) => string): string {
  const k = `tools.builtin.${key}.desc`;
  const val = t(k);
  return val && val !== k ? val : fallback;
}
