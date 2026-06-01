import { type ToolDefinition } from "@opencode-ai/plugin"

import { COMPOSIO_TOOL_MANIFEST, type ComposioToolName } from "./manifest"
import { ComposioSessionManager, type ComposioSessionManagerOptions } from "../composio/session-manager"
import { createSignupTool, createClaimTool } from "../tools/auth"
import { createComposioCliTool } from "../tools/cli"
import { createDebugInfoTool } from "../tools/debug-info"
import { createSaveAutomationDefinitionTool } from "../tools/handoff"
import {
  createGetToolSchemasTool,
  createManageConnectionsTool,
  createMultiExecuteTool,
  createRemoteBashTool,
  createRemoteWorkbenchTool,
  createSearchToolsTool,
} from "../tools/runtime"
import {
  createCreateTriggerTool,
  createDeleteTriggerTool,
  createDisableTriggerTool,
  createEnableTriggerTool,
  createGetTriggerTypeSchemaTool,
  createListTriggersTool,
  createListTriggerTypesTool,
} from "../tools/triggers"

export type ComposioToolRegistry = Record<ComposioToolName, ToolDefinition>

export function buildComposioToolRegistry(options: ComposioSessionManagerOptions = {}): ComposioToolRegistry {
  const sessionManager = new ComposioSessionManager(options)

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
        return [manifestEntry.name, createSearchToolsTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_get_tool_schemas") {
        return [manifestEntry.name, createGetToolSchemasTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_manage_connections") {
        return [manifestEntry.name, createManageConnectionsTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_multi_execute_tool") {
        return [manifestEntry.name, createMultiExecuteTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_cli") {
        return [manifestEntry.name, createComposioCliTool(options)]
      }

      if (manifestEntry.name === "composio_remote_bash_tool") {
        return [manifestEntry.name, createRemoteBashTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_remote_workbench") {
        return [manifestEntry.name, createRemoteWorkbenchTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_list_trigger_types") {
        return [manifestEntry.name, createListTriggerTypesTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_get_trigger_type_schema") {
        return [manifestEntry.name, createGetTriggerTypeSchemaTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_create_trigger") {
        return [manifestEntry.name, createCreateTriggerTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_list_triggers") {
        return [manifestEntry.name, createListTriggersTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_enable_trigger") {
        return [manifestEntry.name, createEnableTriggerTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_disable_trigger") {
        return [manifestEntry.name, createDisableTriggerTool(sessionManager)]
      }

      if (manifestEntry.name === "composio_delete_trigger") {
        return [manifestEntry.name, createDeleteTriggerTool(sessionManager)]
      }

      if (manifestEntry.name === "save_automation_definition") {
        return [manifestEntry.name, createSaveAutomationDefinitionTool()]
      }

      throw new Error(`Unhandled Composio tool manifest entry: ${JSON.stringify(manifestEntry)}`)
    }),
  ) as ComposioToolRegistry
}
