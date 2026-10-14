package server

import (
	"net/http"
	"regexp"
	"strings"
)

// apiErrorTranslations maps historical Chinese API error messages to English.
var apiErrorTranslations = map[string]string{
	"LLM 配置正在被任务或会话修改，请重试": "LLM profile is currently being modified by a task or session; please try again",
	"MCP 不存在": "MCP does not exist",
	"Worker 已删除": "Worker has been deleted",
	"agent 不存在": "Agent does not exist",
	"agent_key 不能为空": "agent_key cannot be empty",
	"ask_timeout_action 必须是 allow 或 deny": "ask_timeout_action must be allow or deny",
	"asset store 未启用": "Asset store is not enabled",
	"binding_ids 必填": "binding_ids is required",
	"company not found": "Company not found",
	"database unavailable": "Database unavailable",
	"decision 必须是 allowed 或 denied": "decision must be allowed or denied",
	"dimension 必须是 project 或 task": "dimension must be project or task",
	"fail_action 必须是 allow、ask 或 deny": "fail_action must be allow, ask, or deny",
	"finding not found": "Finding not found",
	"http 工具必须提供参数 JSON Schema(不能留空)": "HTTP tool must provide parameter JSON Schema (cannot be empty)",
	"invalid id": "Invalid ID",
	"key 需小写字母开头，仅含小写字母/数字/下划线": "Key must start with a lowercase letter and contain only lowercase letters, digits, and underscores",
	"kind 必须是 allow 或 deny": "kind must be allow or deny",
	"kind 需为 command / script / http / shell": "kind must be command, script, http, or shell",
	"llm_profile_id 格式错误": "Invalid llm_profile_id format",
	"name required": "Name is required",
	"scope 必须是 task / session / staging": "scope must be task, session, or staging",
	"shell 类型工具是 bash 环境声明，无可执行内容": "Shell-type tool is a bash environment declaration with no executable content",
	"targets 不能为空": "targets cannot be empty",
	"task_ids 不能为空": "task_ids cannot be empty",
	"token 无效或已过期": "Invalid or expired token",
	"token 生成失败": "Failed to generate token",
	"version 和有效请求体必填": "version and a valid request body are required",
	"一次最多处理 100 个任务": "A maximum of 100 tasks can be processed at once",
	"不是目录": "Not a directory",
	"不能删除工作区根目录": "Cannot delete workspace root directory",
	"主 Agent 正在处理上一条消息，请稍候": "Main Agent is processing the previous message; please wait",
	"任务 id 无效": "Invalid task ID",
	"任务分类不存在或无效": "Task category does not exist or is invalid",
	"任务已归档或正在删除": "Task is archived or being deleted",
	"任务正在删除,无法修改目标": "Task is being deleted; cannot modify goals",
	"任务正在删除,无法修改约束": "Task is being deleted; cannot modify constraints",
	"任务正在删除,无法删除目标": "Task is being deleted; cannot delete goals",
	"任务正在删除,无法删除约束": "Task is being deleted; cannot delete constraints",
	"任务正在删除,无法新增目标": "Task is being deleted; cannot add goals",
	"任务正在删除,无法新增约束": "Task is being deleted; cannot add constraints",
	"任务正在删除，无法发送新消息": "Task is being deleted; cannot send new messages",
	"任务正在删除，无法控制意图": "Task is being deleted; cannot control intents",
	"任务正在删除，无法新建会话": "Task is being deleted; cannot create new sessions",
	"任务正在删除，无法重跑意图": "Task is being deleted; cannot rerun intents",
	"任务正在归档或删除": "Task is being archived or deleted",
	"企业名称已存在": "Company name already exists",
	"关联任务 id 无效或重复": "Associated task ID is invalid or duplicated",
	"关联企业不存在或无效": "Associated company does not exist or is invalid",
	"内置 agent 不可修改名称/描述": "Built-in agent name and description cannot be modified",
	"内置 agent 不可删除": "Built-in agent cannot be deleted",
	"压缩包内未找到 SKILL.md": "SKILL.md not found in the archive",
	"压缩包文件过多": "Archive contains too many files",
	"压缩包解压后过大": "Extracted archive size is too large",
	"只能编辑自定义工具": "Only custom tools can be edited",
	"同一请求 ID 不能用于不同问题": "The same request ID cannot be used for different questions",
	"名称不能为空": "Name cannot be empty",
	"回链地址需以 http:// 或 https:// 开头": "Backlink URL must start with http:// or https://",
	"复测补充说明最多 4000 个字符": "Retest note must be at most 4000 characters",
	"审批记录已被删除或不存在": "Approval record has been deleted or does not exist",
	"密码不能为空": "Password is required",
	"密码加密失败": "Failed to hash password",
	"密码已设置": "Password is already set",
	"密码未初始化，请先设置密码": "Password not initialized; please set a password first",
	"尚无上下文快照，请先运行主 Agent": "No context snapshot available yet; please run the Main Agent first",
	"已有一个更新正在进行中": "An update is already in progress",
	"引用 ID 无效，请重新选择": "Invalid reference ID; please select it again",
	"引用内容过大，请减少引用记录后重试": "Referenced content is too large; reduce the number of records and try again",
	"引用数据暂不可用": "Reference data is temporarily unavailable",
	"引用类型无效或搜索关键词超过 200 字": "Invalid reference type or search keyword exceeds 200 characters",
	"归档 id 无效": "Invalid archive ID",
	"归档不存在": "Archive does not exist",
	"当前密码错误": "Incorrect current password",
	"当前激活的 LLM 配置不能删除，请先激活其他配置": "The currently active LLM profile cannot be deleted; please activate another profile first",
	"投递 id 无效": "Invalid delivery ID",
	"指定的 LLM 配置不存在或无效": "Specified LLM profile does not exist or is invalid",
	"指定的 LLM 配置不存在或未设置 API Key": "Specified LLM profile does not exist or has no API Key set",
	"推送模式无效，可选：realtime / digest": "Invalid notification mode; options: realtime / digest",
	"数据库暂不可用": "Database temporarily unavailable",
	"文件不存在": "File not found",
	"新密码不能为空": "New password is required",
	"旁路服务不可用": "Side question service is unavailable",
	"旁路请求已达并发上限，请稍后重试": "Side question requests have reached concurrency limit; please try again later",
	"无效的请求体": "Invalid request body",
	"是目录，不能作为文件读取": "Target is a directory; cannot read as a file",
	"更新正在进行中，无法回滚": "Update is in progress; cannot rollback",
	"服务正在停止": "Service is shutting down",
	"未授权": "Unauthorized",
	"未检测到 python(python3/python 均不在 PATH)": "Python not detected (neither python3 nor python found in PATH)",
	"标题不能为空": "Title cannot be empty",
	"每条消息最多引用 10 条记录": "A message can reference at most 10 records",
	"汇总周期需在 1 到 1440 分钟之间": "Digest period must be between 1 and 1440 minutes",
	"消息不能为空": "Message cannot be empty",
	"渠道 id 无效": "Invalid channel ID",
	"渠道名称不能为空": "Channel name cannot be empty",
	"漏洞复测 Agent 不存在或未启用，请在 Agent 管理中配置 retester": "Retester Agent does not exist or is not enabled; please configure retester in Agent management",
	"用户名或密码错误": "Incorrect username or password",
	"目标不存在": "Target does not exist",
	"目标内容不能为空": "Goal content cannot be empty",
	"目标写入后读取失败": "Failed to read goal after writing",
	"目标是目录": "Target is a directory",
	"目标更新后读取失败": "Failed to read goal after update",
	"目标目录不存在": "Target directory not found",
	"等待 LLM 配置引用释放超时，请重试": "Timeout waiting for LLM profile references to be released; please try again",
	"管理后台数据源(PostgreSQL)未连接": "Management backend datasource (PostgreSQL) is not connected",
	"约束内容不能为空": "Constraint content cannot be empty",
	"继承漏洞只读，请在来源任务中修改": "Inherited finding is read-only; please edit it in the source task",
	"缺少上传文件(表单字段 file)": "Missing uploaded file (form field file)",
	"缺少上传文件(表单字段 file)或超出大小限制": "Missing uploaded file (form field file) or size limit exceeded",
	"缺少渠道名称": "Channel name is required",
	"至少需要提供 title 或 pinned": "At least title or pinned must be provided",
	"解压后缺少 SKILL.md": "SKILL.md missing after extraction",
	"触发器仅支持自定义 agent": "Triggers only support custom agents",
	"该 agent 无内置默认提示词，无法恢复": "This agent has no built-in default prompt and cannot be restored",
	"该 key 已存在": "Key already exists",
	"该 key 已存在(内置或自定义工具)": "Key already exists (built-in or custom tool)",
	"该会话正在处理上一条消息，请稍候": "This session is processing the previous message; please wait",
	"该意图不是可重跑状态(仅 blocked/exhausted/stopped 可重跑)": "This intent is not in a runnable state (only blocked/exhausted/stopped can be rerun)",
	"请求格式错误": "Invalid request format",
	"请求正文过大": "Request body is too large",
	"请选择流量": "Please select traffic",
	"路径不存在": "Path not found",
	"通知渠道不存在": "Notification channel does not exist",
	"问题须为 1–4000 字符，并提供有效请求 ID": "Question must be 1-4000 characters and include a valid request ID",
	"限流值不能为负": "Rate limit cannot be negative",
	"需要 asset_id": "asset_id is required",
	"非法 id": "Invalid ID",
	"非法 skill 名": "Invalid Skill name",
	"非法路径": "Invalid path",
}

type patternRule struct {
	re *regexp.Regexp
	en string
}

var dynamicPatterns = []patternRule{
	{regexp.MustCompile(`^agent_key 最多 (\d+) 个字符$`), "agent_key must be at most $1 characters"},
	{regexp.MustCompile(`^标题最多 (\d+) 个字符$`), "Title must be at most $1 characters"},
	{regexp.MustCompile(`^渠道类型无效，可选：(.*)$`), "Invalid channel type, available: $1"},
	{regexp.MustCompile(`^渠道类型 (.+) 未注册$`), "Channel type $1 is not registered"},
	{regexp.MustCompile(`^关联任务最多选择 (\d+) 个$`), "At most $1 associated tasks can be selected"},
	{regexp.MustCompile(`^关联任务 #(\d+) 不存在$`), "Associated task #$1 does not exist"},
	{regexp.MustCompile(`^关联企业无效：最多选择 (\d+) 个有效企业$`), "Invalid associated companies: select at most $1 valid companies"},
	{regexp.MustCompile(`^task_ids 数量必须为 1-(\d+)$`), "Number of task_ids must be 1-$1"},
	{regexp.MustCompile(`^当前版本 (.+) 不是正式发布版本，已禁用一键更新$`), "Current version $1 is not an official release, one-click update disabled"},
	{regexp.MustCompile(`^当前已是最新版本 (.+)$`), "Already up to date: $1"},
	{regexp.MustCompile(`^skill 已存在：(.+)（如需覆盖请确认后重试）$`), "Skill already exists: $1 (confirm to overwrite and try again)"},
	{regexp.MustCompile(`^压缩包含非法路径 (.+)：(.*)$`), "Archive contains invalid path $1: $2"},
	{regexp.MustCompile(`^skill 名称无效（取自 SKILL\.md 的 name 字段）：(.+)（≤64 字符，字母开头，只能用小写字母/数字/连字符或中文等非 ASCII 字母，不能有空格、点、路径分隔符）$`), "Invalid Skill name (from SKILL.md name field): $1 (<=64 chars, starts with a letter, only lowercase letters/numbers/hyphens or non-ASCII letters, no spaces, dots or path separators)"},
}

type prefixRule struct {
	prefix string
	en     string
}

var prefixRules = []prefixRule{
	{"未知工具类型: ", "Unknown tool type: "},
	{"请求体不是合法 JSON: ", "Request body is not valid JSON: "},
	{"任务级拦截规则无效：", "Task-level interception rule invalid: "},
	{"工具不存在: ", "Tool does not exist: "},
	{"非内置工具或不存在: ", "Not a built-in tool or does not exist: "},
	{"工具发现失败：", "Tool discovery failed: "},
	{"读取 SKILL.md 失败：", "Failed to read SKILL.md: "},
	{"文件过大：", "File too large: "},
	{"安装失败：", "Installation failed: "},
	{"list_projects_data 失败: ", "list_projects_data failed: "},
	{"解析项目列表失败: ", "Failed to parse project list: "},
	{"list_tasks 失败: ", "list_tasks failed: "},
	{"解析任务列表失败: ", "Failed to parse task list: "},
	{"创建失败: ", "Failed to create: "},
	{"更新失败: ", "Failed to update: "},
	{"删除失败: ", "Failed to delete: "},
	{"读取失败: ", "Failed to read: "},
	{"保存失败: ", "Failed to save: "},
}

// toEnglishError translates any legacy Chinese error message to English.
func toEnglishError(msg string) string {
	msg = strings.TrimSpace(msg)
	if msg == "" {
		return ""
	}
	if en, ok := apiErrorTranslations[msg]; ok {
		return en
	}
	for _, rule := range dynamicPatterns {
		if rule.re.MatchString(msg) {
			return rule.re.ReplaceAllString(msg, rule.en)
		}
	}
	for _, rule := range prefixRules {
		if strings.HasPrefix(msg, rule.prefix) {
			rest := strings.TrimPrefix(msg, rule.prefix)
			return rule.en + rest
		}
	}
	return msg
}

func localizedErr(w http.ResponseWriter, r *http.Request, code int, msg string) {
	writeErr(w, code, msg)
}
