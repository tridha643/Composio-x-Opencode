import { tool } from "@opencode-ai/plugin"

import { type ComposioToolManifestEntry } from "../plugin/manifest"

type PlaceholderPayload = {
  ok: false
  code: "not_implemented_in_phase_1"
  tool: ComposioToolManifestEntry["name"]
  phase: 1
  targetPhase: ComposioToolManifestEntry["phase"]
  message: string
}

function formatPlaceholderOutput(payload: PlaceholderPayload) {
  return {
    title: "Composio tool placeholder",
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

export function createPlaceholderTool(manifestEntry: ComposioToolManifestEntry) {
  return tool({
    description: manifestEntry.description,
    args: {},
    async execute() {
      return formatPlaceholderOutput({
        ok: false,
        code: "not_implemented_in_phase_1",
        tool: manifestEntry.name,
        phase: 1,
        targetPhase: manifestEntry.phase,
        message: `${manifestEntry.name} is registered for the stable v1 namespace, but its Composio behavior lands in Phase ${manifestEntry.phase}.`,
      })
    },
  })
}
