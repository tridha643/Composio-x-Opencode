import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { Plugin, PluginInput } from "@opencode-ai/plugin"

import { REGISTERED_TOOL_NAMES } from "../src/tools/names"

function createPluginInput(): PluginInput {
  return {
    client: {} as PluginInput["client"],
    project: {} as PluginInput["project"],
    directory: process.cwd(),
    worktree: process.cwd(),
    experimental_workspace: {
      register() {},
    },
    serverUrl: new URL("http://localhost"),
    $: (() => {}) as unknown as PluginInput["$"],
  }
}

function fail(message: string): never {
  console.error(`smoke:local failed: ${message}`)
  process.exit(1)
}

const distIndexPath = resolve(process.cwd(), "dist/index.js")

if (!existsSync(distIndexPath)) {
  fail("dist/index.js is missing. Run `bun run build` before `bun run smoke:local`.")
}

const builtModule = (await import(pathToFileURL(distIndexPath).href)) as {
  default?: Plugin
}

if (typeof builtModule.default !== "function") {
  fail("dist/index.js does not export a default opencode plugin function.")
}

const hooks = await builtModule.default(createPluginInput())
const actualToolNames = Object.keys(hooks.tool ?? {})
const expectedToolNames = [...REGISTERED_TOOL_NAMES]

if (JSON.stringify(actualToolNames) !== JSON.stringify(expectedToolNames)) {
  fail(
    `registered tool mismatch. Expected ${expectedToolNames.join(", ")}; got ${
      actualToolNames.length > 0 ? actualToolNames.join(", ") : "none"
    }`,
  )
}

console.log(
  `smoke:local ok: ${actualToolNames.length} tools registered; config example: examples/opencode.local.jsonc`,
)
