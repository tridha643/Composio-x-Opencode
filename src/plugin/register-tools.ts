import { type ToolDefinition } from "@opencode-ai/plugin"

import { COMPOSIO_TOOL_MANIFEST, type ComposioToolName } from "./manifest"
import { createPlaceholderTool } from "../tools/static-placeholders"

export type ComposioToolRegistry = Record<ComposioToolName, ToolDefinition>

export function buildComposioToolRegistry(): ComposioToolRegistry {
  return Object.fromEntries(
    COMPOSIO_TOOL_MANIFEST.map((manifestEntry) => [
      manifestEntry.name,
      createPlaceholderTool(manifestEntry),
    ]),
  ) as ComposioToolRegistry
}
