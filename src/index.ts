import { type Plugin } from "@opencode-ai/plugin"

import { buildComposioToolRegistry } from "./plugin/register-tools"

const plugin = (async () => {
  return {
    tool: buildComposioToolRegistry(),
  }
}) satisfies Plugin

export default plugin
