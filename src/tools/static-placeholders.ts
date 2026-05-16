import { tool } from "@opencode-ai/plugin"

import { type ComposioToolManifestEntry } from "../plugin/manifest"
import { PACKAGE_NAME, PACKAGE_VERSION } from "../shared/version"
import { REGISTERED_TOOL_NAMES } from "./names"

type PlaceholderPayload =
  | {
      ok: true
      registered: true
      registeredTools: typeof REGISTERED_TOOL_NAMES
      packageName: typeof PACKAGE_NAME
      packageVersion: typeof PACKAGE_VERSION
    }
  | {
      ok: false
      code: "not_implemented_in_phase_1"
      tool: ComposioToolManifestEntry["name"]
      phase: 1
      message: string
    }

function formatPlaceholderOutput(payload: PlaceholderPayload) {
  return {
    title: payload.ok ? "Composio plugin registered" : "Composio tool placeholder",
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

export function createPlaceholderTool(manifestEntry: ComposioToolManifestEntry) {
  return tool({
    description: manifestEntry.description,
    args: {},
    async execute() {
      if (manifestEntry.name === "composio_debug_info") {
        return formatPlaceholderOutput({
          ok: true,
          registered: true,
          registeredTools: REGISTERED_TOOL_NAMES,
          packageName: PACKAGE_NAME,
          packageVersion: PACKAGE_VERSION,
        })
      }

      return formatPlaceholderOutput({
        ok: false,
        code: "not_implemented_in_phase_1",
        tool: manifestEntry.name,
        phase: 1,
        message: `${manifestEntry.name} is registered for the stable v1 namespace, but its Composio behavior lands in Phase ${manifestEntry.phase}.`,
      })
    },
  })
}
