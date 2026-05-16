import { type ToolDefinition } from "@opencode-ai/plugin"

import { COMPOSIO_TOOL_MANIFEST, type ComposioToolName } from "./manifest"
import { createSignupTool, createClaimTool } from "../tools/auth"
import { createDebugInfoTool } from "../tools/debug-info"
import { createPlaceholderTool } from "../tools/static-placeholders"

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

      return [manifestEntry.name, createPlaceholderTool(manifestEntry)]
    }),
  ) as ComposioToolRegistry
}
