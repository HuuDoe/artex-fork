/**
 * English catalog.
 *
 * Must define every key in `./zh-CN` (the source locale).
 */

import type { Dictionary } from "../dictionary";

export const en: Dictionary = {
  // --- app shell / navigation ---
  "nav.dashboard": "Dashboard",
  "nav.function": "Workspace",
  "nav.system": "System",
  "nav.llm": "LLM",
  "nav.settings": "System Settings",
  "nav.agents": "Agents",
  "nav.mcp": "MCP",
  "nav.tools": "Toolbox",
  "nav.skills": "Skills",
  "nav.intercept": "Interception Approval",
  "nav.notify": "Notification Channels",
  "nav.logs": "System Logs",
  "nav.tasks": "Tasks",
  "nav.findings": "Findings",
  "nav.assets": "Assets",
  "nav.traffic": "Traffic Capture",
  "nav.chat": "Chat",
  "nav.workspace": "Workspace",
  "nav.commands": "Command Sets",
  "nav.sync": "Asset Sync",
  "nav.llmRecords": "LLM Records",
  "nav.collapse": "Collapse sidebar",
  "nav.expand": "Expand sidebar",

  // --- generic actions ---
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.confirm": "Confirm",
  "action.delete": "Delete",
  "action.edit": "Edit",
  "action.add": "Add",
  "action.create": "Create",
  "action.close": "Close",
  "action.search": "Search",
  "action.reset": "Reset",
  "action.refresh": "Refresh",
  "action.retry": "Retry",
  "action.copy": "Copy",
  "action.copied": "Copied",
  "action.view": "View",
  "action.detail": "Details",
  "action.back": "Back",
  "action.next": "Next",
  "action.prev": "Previous",
  "action.submit": "Submit",
  "action.test": "Test",
  "action.loading": "Loading…",
  "action.noData": "No data",
  "action.all": "All",
  "action.more": "More",
  "action.expand": "Expand",
  "action.collapse": "Collapse",
  "action.select": "Select",
  "action.clear": "Clear",
  "action.apply": "Apply",
  "action.rollback": "Roll back",

  // --- generic state ---
  "state.enabled": "Enabled",
  "state.disabled": "Disabled",
  "state.loading": "Loading",
  "state.success": "Success",
  "state.failed": "Failed",
  "state.unknown": "Unknown",
  "state.running": "Running",
  "state.stopped": "Stopped",
  "state.pending": "Pending",
  "state.completed": "Completed",
  "state.queued": "Queued",

  // --- language ---
  "settings.language.title": "Interface Language",
  "settings.language.description":
    "Choose the language used for the interface. Stored in this browser only; it does not sync with your account.",
  "settings.language.changed": "Interface language changed",

  // --- system settings page ---
  "settings.page.title": "System Settings",
  "settings.page.subtitle": "Global runtime switches",
  "settings.update.title": "Version & Update",
  "settings.update.description":
    "Check GitHub for and install new versions. Updating restarts the program and interrupts running tasks.",
  "settings.trafficCapture.title": "Traffic Capture",
  "settings.trafficCapture.description":
    "When enabled, all Agent HTTP traffic is recorded in full via the recording proxy, and the traffic_search / traffic_get tools plus proxy configuration are injected into agents (the prompt includes proxy instructions).",
  "settings.trafficCapture.descriptionOff":
    "When disabled (default) no traffic is recorded: agents do not receive the proxy configuration or traffic tools, and the prompt does not mention the proxy. Changes take effect immediately by rebuilding agents.",
  "settings.trafficCapture.label": "Record all Agent HTTP traffic",
  "settings.agentTrafficBinding.title": "Auto-bind Traffic to Agents",
  "settings.agentTrafficBinding.label": "Bind new tasks to the recording proxy automatically",
  "settings.proxy.title": "Global Proxy",
  "settings.proxy.description":
    "Proxy used when reaching GitHub, model providers and other external endpoints, e.g. http://127.0.0.1:7890. Leave empty to disable.",
  "settings.proxy.placeholder": "http://127.0.0.1:7890",
  "settings.constraints.title": "Constraint Injection",
  "settings.constraints.planner": "Inject constraints into planner",
  "settings.constraints.worker": "Inject constraints into worker",
  "settings.experimental.title": "Experimental",
  "settings.experimental.noa": "noa context compaction",
  "settings.websearch.title": "Web Search",
  "settings.websearch.enable": "Enable the web search tool",
  "settings.websearch.backend": "Search backend",
  "settings.websearch.proxy": "Search egress proxy",
  "settings.websearch.workers": "Concurrency · Work Agents",
  "settings.workers.description":
    "How many work agents run concurrently in a single task. Takes effect for tasks started afterwards.",
  "settings.python.title": "Custom Scripts · Python Interpreter",
  "settings.python.description":
    "Python interpreter used to run custom scripts. Leave empty to use the system default python3.",
  "settings.python.detect": "Auto-detect",
  "settings.sendKey.title": "Chat Send Key",
  "settings.sendKey.description": "This preference lives in this browser only and does not sync with your account.",

  // --- common ---
  "common.confirmDelete": "Delete this item? This action cannot be undone.",
  "common.loadFailed": "Failed to load",
  "common.saveFailed": "Save failed: {message}",
  "common.name": "Name",
  "common.type": "Type",
  "common.status": "Status",
  "common.actions": "Actions",
  "common.createdAt": "Created at",
  "common.updatedAt": "Updated at",
  "common.description": "Description",
  "common.optional": "Optional",
  "common.required": "Required",
  "common.yes": "Yes",
  "common.no": "No",
  "common.total": "{count} total",
};
