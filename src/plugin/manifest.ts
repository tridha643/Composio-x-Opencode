export type ComposioToolCategory =
  | "diagnostics"
  | "auth"
  | "meta"
  | "remote"
  | "trigger"
  | "handoff"

export type ComposioToolRisk = "safe" | "auth" | "network" | "open_world" | "destructive"

export type ComposioToolName = (typeof COMPOSIO_TOOL_NAMES)[number]

export type ComposioToolManifestEntry = {
  readonly name: ComposioToolName
  readonly description: string
  readonly category: ComposioToolCategory
  readonly risk: ComposioToolRisk
  readonly phase: number
}

export const COMPOSIO_TOOL_NAMES = [
  "composio_debug_info",
  "composio_signup",
  "composio_claim",
  "composio_search_tools",
  "composio_get_tool_schemas",
  "composio_manage_connections",
  "composio_multi_execute_tool",
  "composio_remote_bash_tool",
  "composio_remote_workbench",
  "composio_list_trigger_types",
  "composio_get_trigger_type_schema",
  "composio_create_trigger",
  "composio_list_triggers",
  "composio_enable_trigger",
  "composio_disable_trigger",
  "composio_delete_trigger",
  "save_automation_definition",
] as const

export const COMPOSIO_TOOL_MANIFEST = [
  {
    name: "composio_debug_info",
    description: "Show composio-x-opencode registration diagnostics without contacting Composio.",
    category: "diagnostics",
    risk: "safe",
    phase: 1,
  },
  {
    name: "composio_signup",
    description: "Provision first-use anonymous Composio credentials in a later phase.",
    category: "auth",
    risk: "auth",
    phase: 2,
  },
  {
    name: "composio_claim",
    description: "Request organization handoff for an anonymous Composio identity in a later phase.",
    category: "auth",
    risk: "auth",
    phase: 2,
  },
  {
    name: "composio_search_tools",
    description: "Search Composio's available tools through the meta-tool runtime in a later phase.",
    category: "meta",
    risk: "network",
    phase: 3,
  },
  {
    name: "composio_get_tool_schemas",
    description: "Fetch Composio tool schemas before execution in a later phase.",
    category: "meta",
    risk: "network",
    phase: 3,
  },
  {
    name: "composio_manage_connections",
    description: "Inspect or initiate Composio connected-account flows in a later phase.",
    category: "meta",
    risk: "auth",
    phase: 3,
  },
  {
    name: "composio_multi_execute_tool",
    description: "Execute one or more Composio tools through structured meta-tool calls in a later phase.",
    category: "meta",
    risk: "network",
    phase: 3,
  },
  {
    name: "composio_remote_bash_tool",
    description: "Run explicitly remote/open-world Composio bash capability in a later phase.",
    category: "remote",
    risk: "open_world",
    phase: 3,
  },
  {
    name: "composio_remote_workbench",
    description: "Use explicitly remote/open-world Composio workbench capability in a later phase.",
    category: "remote",
    risk: "open_world",
    phase: 3,
  },
  {
    name: "composio_list_trigger_types",
    description: "List Composio trigger types available for authoring in a later phase.",
    category: "trigger",
    risk: "network",
    phase: 4,
  },
  {
    name: "composio_get_trigger_type_schema",
    description: "Inspect the configuration schema for a Composio trigger type in a later phase.",
    category: "trigger",
    risk: "network",
    phase: 4,
  },
  {
    name: "composio_create_trigger",
    description: "Create or upsert a Composio trigger instance in a later phase.",
    category: "trigger",
    risk: "network",
    phase: 4,
  },
  {
    name: "composio_list_triggers",
    description: "List existing Composio trigger instances in a later phase.",
    category: "trigger",
    risk: "network",
    phase: 4,
  },
  {
    name: "composio_enable_trigger",
    description: "Enable an exact Composio trigger instance in a later phase.",
    category: "trigger",
    risk: "destructive",
    phase: 4,
  },
  {
    name: "composio_disable_trigger",
    description: "Disable an exact Composio trigger instance in a later phase.",
    category: "trigger",
    risk: "destructive",
    phase: 4,
  },
  {
    name: "composio_delete_trigger",
    description: "Permanently delete an exact Composio trigger instance in a later phase.",
    category: "trigger",
    risk: "destructive",
    phase: 4,
  },
  {
    name: "save_automation_definition",
    description: "Persist Pi-compatible automation handoff metadata in a later phase.",
    category: "handoff",
    risk: "network",
    phase: 5,
  },
] as const satisfies readonly ComposioToolManifestEntry[]
