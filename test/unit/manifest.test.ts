import { describe, expect, test } from "bun:test"

import { COMPOSIO_TOOL_NAMES } from "../../src/plugin/manifest"

const FORBIDDEN_BUILT_IN_OR_GENERIC_NAMES = new Set([
  "bash",
  "read",
  "write",
  "edit",
  "search",
  "debug",
  "delete",
  "claim",
])

const PHASE_1_RESEARCH_ORDER = [
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

describe("Phase 1 Composio tool manifest", () => {
  test("keeps exactly 17 unique names in the researched order", () => {
    expect(COMPOSIO_TOOL_NAMES).toHaveLength(17)
    expect(new Set(COMPOSIO_TOOL_NAMES).size).toBe(COMPOSIO_TOOL_NAMES.length)
    expect(COMPOSIO_TOOL_NAMES).toEqual(PHASE_1_RESEARCH_ORDER)
  })

  test("uses lowercase opencode-safe names with the expected namespace", () => {
    for (const toolName of COMPOSIO_TOOL_NAMES) {
      expect(toolName).toMatch(/^[a-z][a-z0-9_]*$/)

      if (toolName !== "save_automation_definition") {
        expect(toolName.startsWith("composio_")).toBe(true)
      }
    }
  })

  test("does not collide with built-in or generic tool names", () => {
    for (const toolName of COMPOSIO_TOOL_NAMES) {
      expect(FORBIDDEN_BUILT_IN_OR_GENERIC_NAMES.has(toolName)).toBe(false)
    }
  })
})
