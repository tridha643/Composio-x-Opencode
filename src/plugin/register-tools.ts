import { type ToolDefinition } from "@opencode-ai/plugin"

import { COMPOSIO_TOOL_MANIFEST, type ComposioToolName } from "./manifest"
import { createSignupTool, createClaimTool } from "../tools/auth"
import { createDebugInfoTool } from "../tools/debug-info"
import {
  createGetToolSchemasTool,
  createManageConnectionsTool,
  createMultiExecuteTool,
  createRemoteBashTool,
  createRemoteWorkbenchTool,
  createSearchToolsTool,
} from "../tools/meta"
import {
  createCreateTriggerTool,
  createDeleteTriggerTool,
  createDisableTriggerTool,
  createEnableTriggerTool,
  createGetTriggerTypeSchemaTool,
  createListTriggerTypesTool,
  createListTriggersTool,
} from "../tools/triggers"
import { createSaveAutomationDefinitionTool } from "../tools/automation-definition"

export type ComposioToolRegistry = Record<ComposioToolName, ToolDefinition>

export function buildComposioToolRegistry(): ComposioToolRegistry {
  return Object.fromEntries(
    COMPOSIO_TOOL_MANIFEST.map((manifestEntry) => {
      if (manifestEntry.name === "composio_debug_info") {
        return [manifestEntry.name, createDebugInfoTool()]
      }

      if (manifestEntry.name === "composio_signup") {
        return [manifestEntry.name, createSignupTool()]
      }

      if (manifestEntry.name === "composio_claim") {
        return [manifestEntry.name, createClaimTool()]
      }

      if (manifestEntry.name === "composio_search_tools") {
        return [manifestEntry.name, createSearchToolsTool()]
      }

      if (manifestEntry.name === "composio_get_tool_schemas") {
        return [manifestEntry.name, createGetToolSchemasTool()]
      }

      if (manifestEntry.name === "composio_manage_connections") {
        return [manifestEntry.name, createManageConnectionsTool()]
      }

      if (manifestEntry.name === "composio_multi_execute_tool") {
        return [manifestEntry.name, createMultiExecuteTool()]
      }

      if (manifestEntry.name === "composio_remote_bash_tool") {
        return [manifestEntry.name, createRemoteBashTool()]
      }

      if (manifestEntry.name === "composio_remote_workbench") {
        return [manifestEntry.name, createRemoteWorkbenchTool()]
      }

      if (manifestEntry.name === "composio_list_trigger_types") {
        return [manifestEntry.name, createListTriggerTypesTool()]
      }

      if (manifestEntry.name === "composio_get_trigger_type_schema") {
        return [manifestEntry.name, createGetTriggerTypeSchemaTool()]
      }

      if (manifestEntry.name === "composio_create_trigger") {
        return [manifestEntry.name, createCreateTriggerTool()]
      }

      if (manifestEntry.name === "composio_list_triggers") {
        return [manifestEntry.name, createListTriggersTool()]
      }

      if (manifestEntry.name === "composio_enable_trigger") {
        return [manifestEntry.name, createEnableTriggerTool()]
      }

      if (manifestEntry.name === "composio_disable_trigger") {
        return [manifestEntry.name, createDisableTriggerTool()]
      }

      if (manifestEntry.name === "composio_delete_trigger") {
        return [manifestEntry.name, createDeleteTriggerTool()]
      }

      if (manifestEntry.name === "save_automation_definition") {
        return [manifestEntry.name, createSaveAutomationDefinitionTool()]
      }

      const _exhaustive: never = manifestEntry
      throw new Error(`Unhandled Composio tool manifest entry: ${JSON.stringify(_exhaustive)}`)
    }),
  ) as ComposioToolRegistry
}
