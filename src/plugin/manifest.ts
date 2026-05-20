export type ComposioToolCategory =
  | "diagnostics"
  | "auth"
  | "meta"
  | "remote"
  | "trigger"
  | "handoff"

export type ComposioToolRisk = "safe" | "auth" | "network" | "open_world" | "destructive" | "local_write"

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
    description:
      "Show redacted composio-x-opencode runtime, auth-source, handoff, and registered-tool diagnostics without contacting Composio.",
    category: "diagnostics",
    risk: "safe",
    phase: 1,
  },
  {
    name: "composio_signup",
    description:
      "Provision or reuse first-use anonymous Composio credentials through the official agent signup flow with redacted output.",
    category: "auth",
    risk: "auth",
    phase: 2,
  },
  {
    name: "composio_claim",
    description:
      "Request email handoff for an anonymous Composio identity; use /composio-claim <email> for the slash-command path.",
    category: "auth",
    risk: "auth",
    phase: 2,
  },
  {
    name: "composio_search_tools",
    description:
      "Search Composio's tool catalog for use cases, returning tool slugs, schemas, connection status, and execution guidance.",
    category: "meta",
    risk: "network",
    phase: 3,
  },
  {
    name: "composio_get_tool_schemas",
    description: "Fetch exact Composio tool schemas for known tool slugs before execution.",
    category: "meta",
    risk: "network",
    phase: 3,
  },
  {
    name: "composio_manage_connections",
    description:
      "Inspect or initiate Composio connected-account auth flows; may create OAuth/API-key links or reinitiate connections.",
    category: "meta",
    risk: "auth",
    phase: 3,
  },
  {
    name: "composio_multi_execute_tool",
    description:
      "Execute one or more third-party Composio app tools; may mutate external service state and should follow schema lookup.",
    category: "meta",
    risk: "network",
    phase: 3,
  },
  {
    name: "composio_remote_bash_tool",
    description:
      "Run bash in Composio's remote sandbox, not locally; open-world remote code execution for file/data processing.",
    category: "remote",
    risk: "open_world",
    phase: 3,
  },
  {
    name: "composio_remote_workbench",
    description:
      "Run Python in Composio's persistent remote workbench sandbox, not locally; open-world remote code execution.",
    category: "remote",
    risk: "open_world",
    phase: 3,
  },
  {
    name: "composio_list_trigger_types",
    description: "List Composio trigger types for schema-first authoring, with toolkit/version filters and pagination.",
    category: "trigger",
    risk: "network",
    phase: 4,
  },
  {
    name: "composio_get_trigger_type_schema",
    description: "Inspect the exact configuration and payload schema for a selected Composio trigger type before creation.",
    category: "trigger",
    risk: "network",
    phase: 4,
  },
  {
    name: "composio_create_trigger",
    description: "Create or upsert a Composio trigger instance and return trigger ID plus connected-account guidance.",
    category: "trigger",
    risk: "network",
    phase: 4,
  },
  {
    name: "composio_list_triggers",
    description: "List existing Composio trigger instances with IDs, slugs/names, status, versions, and account references.",
    category: "trigger",
    risk: "network",
    phase: 4,
  },
  {
    name: "composio_enable_trigger",
    description: "Enable an exact Composio trigger instance by trigger ID, resuming event delivery for automations.",
    category: "trigger",
    risk: "destructive",
    phase: 4,
  },
  {
    name: "composio_disable_trigger",
    description: "Disable an exact Composio trigger instance by trigger ID, pausing events without deleting it.",
    category: "trigger",
    risk: "destructive",
    phase: 4,
  },
  {
    name: "composio_delete_trigger",
    description: "Permanently delete an exact Composio trigger instance by trigger ID; destructive and irreversible.",
    category: "trigger",
    risk: "destructive",
    phase: 4,
  },
  {
    name: "save_automation_definition",
    description:
      "Persist Pi-compatible automation handoff metadata to a local JSON file, upserting by trigger ID.",
    category: "handoff",
    risk: "local_write",
    phase: 5,
  },
] as const satisfies readonly ComposioToolManifestEntry[]
